#include "Race/NairobiRaceManager.h"

#include "GameModes/NairobiRacePlayerState.h"
#include "World/NairobiRaceTrackData.h"
#include "NairobiRacing.h"

#include <limits>

ANairobiRaceManager::ANairobiRaceManager()
{
	PrimaryActorTick.bCanEverTick = false;
	bReplicates = false;
	bOnlyRelevantToOwner = false;
}

void ANairobiRaceManager::BeginPlay()
{
	Super::BeginPlay();

	if (!HasAuthority())
	{
		// Defensive: competitive authority must never exist on a client.
		UE_LOG(LogNairobiRace, Error, TEXT("ANairobiRaceManager spawned without authority; competitive rules disabled."));
		SetActorTickEnabled(false);
	}
}

void ANairobiRaceManager::InitializeRace(UNairobiRaceTrackData* InTrackData, int32 InTotalLaps, float InStartTimeSeconds)
{
	if (!HasAuthority())
	{
		return;
	}

	TrackData = InTrackData;
	TotalLaps = FMath::Max(1, InTotalLaps);
	RaceStartTimeSeconds = InStartTimeSeconds;

	FScopeLock Lock(&ProgressLock);
	for (TPair<TWeakObjectPtr<ANairobiRacePlayerState>, FNairobiRacerRuntime>& Pair : RacerProgress)
	{
		Pair.Value.Progress = NairobiRacing::Core::CreateRaceProgress(TotalLaps);
		Pair.Value.CurrentLapGhost.clear();
		Pair.Value.LastGhostSampleTime = -1.0;
		Pair.Value.PenaltySeconds = 0.0;
	}
}

void ANairobiRaceManager::RegisterRacer(ANairobiRacePlayerState* Racer)
{
	if (!HasAuthority() || Racer == nullptr)
	{
		return;
	}

	FScopeLock Lock(&ProgressLock);
	FNairobiRacerRuntime& Runtime = RacerProgress.FindOrAdd(Racer);
	Runtime.Progress = NairobiRacing::Core::CreateRaceProgress(TotalLaps);
}

void ANairobiRaceManager::UnregisterRacer(ANairobiRacePlayerState* Racer)
{
	if (!HasAuthority() || Racer == nullptr)
	{
		return;
	}
	FScopeLock Lock(&ProgressLock);
	RacerProgress.Remove(Racer);
}

NairobiRacing::Core::FVec2 ANairobiRaceManager::ToRulesPosition(const FVector& WorldLocationCm)
{
	// Unreal X = north, Y = east, centimetres. Rules work in metres on the XY plane.
	return NairobiRacing::Core::FVec2{ WorldLocationCm.X / 100.0, WorldLocationCm.Y / 100.0 };
}

std::vector<NairobiRacing::Core::FCheckpointDefinition> ANairobiRaceManager::BuildGateDefinitions() const
{
	std::vector<NairobiRacing::Core::FCheckpointDefinition> Gates;
	if (!TrackData)
	{
		return Gates;
	}

	Gates.reserve(static_cast<std::size_t>(TrackData->Checkpoints.Num()));
	for (const FNairobiCheckpointRow& Checkpoint : TrackData->Checkpoints)
	{
		NairobiRacing::Core::FCheckpointDefinition Gate;
		Gate.Id = Checkpoint.Id;
		Gate.Center = NairobiRacing::Core::FVec2{ Checkpoint.CenterX / 100.0, Checkpoint.CenterY / 100.0 };
		Gate.RadiusMeters = FMath::Max(2.0, Checkpoint.RadiusCm / 100.0);
		Gate.bIsFinishLine = Checkpoint.bIsFinishLine;
		Gates.push_back(Gate);
	}
	return Gates;
}

bool ANairobiRaceManager::SubmitCheckpoint(
	ANairobiRacePlayerState* Racer,
	int32 CheckpointId,
	const FVector& WorldLocationCm,
	float ServerRaceTimeSeconds)
{
	if (!HasAuthority() || Racer == nullptr || !TrackData)
	{
		return false;
	}

	const std::vector<NairobiRacing::Core::FCheckpointDefinition> Gates = BuildGateDefinitions();

	FScopeLock Lock(&ProgressLock);
	FNairobiRacerRuntime* Runtime = RacerProgress.Find(Racer);
	if (Runtime == nullptr)
	{
		// Insert directly: RegisterRacer takes the same non-recursive lock.
		FNairobiRacerRuntime& Created = RacerProgress.Add(Racer);
		Created.Progress = NairobiRacing::Core::CreateRaceProgress(TotalLaps);
		Runtime = &Created;
	}
	if (Runtime == nullptr)
	{
		return false;
	}

	// The official clock is server time; a client cannot influence it.
	Runtime->Progress.RaceTimeSeconds = FMath::Max(0.f, ServerRaceTimeSeconds - RaceStartTimeSeconds);
	Runtime->Progress.TotalLaps = TotalLaps;

	const NairobiRacing::Core::FCheckpointOutcome Outcome = NairobiRacing::Core::SubmitCheckpoint(
		Runtime->Progress,
		Gates,
		CheckpointId,
		ToRulesPosition(WorldLocationCm));

	if (!Outcome.bAccepted)
	{
		Racer->SetLastRejectedCheckpoint(CheckpointId);
		LogAudit(TEXT("CheckpointRejected"), Racer,
			FString::Printf(TEXT("gate=%d reason=%s"), CheckpointId, ANSI_TO_TCHAR(NairobiRacing::Core::ToString(Outcome.Verdict))));
		OnCheckpointRejected.Broadcast(Racer, CheckpointId);
		return false;
	}

	Racer->SetRaceProgress(
		Runtime->Progress.NextCheckpointIndex,
		Runtime->Progress.Lap,
		Runtime->Progress.LapsCompleted,
		static_cast<float>(Runtime->Progress.BestLapSeconds));

	OnRacerProgressed.Broadcast(Racer, Runtime->Progress.NextCheckpointIndex, Runtime->Progress.Lap);

	if (Outcome.Verdict == NairobiRacing::Core::ECheckpointVerdict::AcceptedLapCompleted)
	{
		HandleRacerCompletedLap(Racer, *Runtime, Outcome.LapTimeSeconds, ServerRaceTimeSeconds);
	}
	else if (Outcome.Verdict == NairobiRacing::Core::ECheckpointVerdict::AcceptedRaceFinished)
	{
		HandleRacerCompletedLap(Racer, *Runtime, Outcome.LapTimeSeconds, ServerRaceTimeSeconds);

		const float OfficialTime = FMath::Max(0.f, ServerRaceTimeSeconds - RaceStartTimeSeconds);
		Racer->SetFinished(OfficialTime);
		LogAudit(TEXT("RacerFinished"), Racer, FString::Printf(TEXT("officialTime=%.3f"), OfficialTime));
		OnRacerFinished.Broadcast(Racer);
	}

	return true;
}

void ANairobiRaceManager::HandleRacerCompletedLap(
	ANairobiRacePlayerState* Racer,
	FNairobiRacerRuntime& Runtime,
	double LapTimeSeconds,
	float ServerRaceTimeSeconds)
{
	if (!TrackData || Racer == nullptr)
	{
		return;
	}

	const double EffectiveLap = LapTimeSeconds + Runtime.PenaltySeconds;
	const bool bPlausible = NairobiRacing::Core::IsPlausibleLapTime(
		LapTimeSeconds,
		TrackData->TrackLengthMeters,
		60.0); // conservative envelope; per-vehicle max speed is checked in ValidateVehicle

	if (!bPlausible)
	{
		Runtime.PenaltySeconds += 5.0;
		LogAudit(TEXT("LapTimeFlagged"), Racer, FString::Printf(TEXT("lap=%.3f penalty=%.1f"), LapTimeSeconds, Runtime.PenaltySeconds));
	}

	// Promote the lap's ghost to the racer's best when it is a validated improvement.
	const double CurrentBest = Racer->BestLapGhostTime;
	if (bPlausible && (CurrentBest <= 0.0 || EffectiveLap < CurrentBest) && Runtime.CurrentLapGhost.size() >= 2)
	{
		Racer->BestLapGhost.Reset();
		for (const NairobiRacing::Core::FGhostSample& Sample : Runtime.CurrentLapGhost)
		{
			FNairobiGhostSample Converted;
			Converted.TimeSeconds = static_cast<float>(Sample.TimeSeconds);
			Converted.PositionCm = FVector2D(Sample.Position.X * 100.0, Sample.Position.Y * 100.0);
			Converted.YawRadians = static_cast<float>(Sample.YawRadians);
			Racer->BestLapGhost.Add(Converted);
		}
		Racer->BestLapGhostTime = static_cast<float>(EffectiveLap);
	}

	Runtime.CurrentLapGhost.clear();
	Runtime.LastGhostSampleTime = -1.0;
	Runtime.PenaltySeconds = 0.0;
}

void ANairobiRaceManager::RecordGhostSample(
	ANairobiRacePlayerState* Racer,
	const FVector& WorldLocationCm,
	float YawRadians,
	float ServerRaceTimeSeconds)
{
	if (!HasAuthority() || Racer == nullptr)
	{
		return;
	}

	FScopeLock Lock(&ProgressLock);
	FNairobiRacerRuntime* Runtime = RacerProgress.Find(Racer);
	if (Runtime == nullptr)
	{
		return;
	}

	// 12.5 Hz sampling keeps ghosts small (<= 6000 samples) while staying smooth.
	constexpr double SampleIntervalSeconds = 0.08;
	const double Elapsed = FMath::Max(0.f, ServerRaceTimeSeconds - RaceStartTimeSeconds);
	if (Runtime->LastGhostSampleTime >= 0.0 && (Elapsed - Runtime->LastGhostSampleTime) < SampleIntervalSeconds)
	{
		return;
	}

	NairobiRacing::Core::FGhostSample Sample;
	Sample.TimeSeconds = Elapsed - Runtime->Progress.LapStartTimeSeconds;
	Sample.Position = ToRulesPosition(WorldLocationCm);
	Sample.YawRadians = NairobiRacing::Core::NormalizeAngleRadians(YawRadians);
	Runtime->CurrentLapGhost.push_back(Sample);
	Runtime->LastGhostSampleTime = Elapsed;

	if (Runtime->CurrentLapGhost.size() > 6000)
	{
		Runtime->CurrentLapGhost.erase(Runtime->CurrentLapGhost.begin());
	}
}

void ANairobiRaceManager::UpdateStandings(float ServerRaceTimeSeconds)
{
	if (!HasAuthority() || !TrackData)
	{
		return;
	}

	FScopeLock Lock(&ProgressLock);

	TArray<TPair<ANairobiRacePlayerState*, NairobiRacing::Core::FStandingInput>> Inputs;
	std::vector<NairobiRacing::Core::FStandingInput> RulesInputs;

	for (TPair<TWeakObjectPtr<ANairobiRacePlayerState>, FNairobiRacerRuntime>& Pair : RacerProgress)
	{
		ANairobiRacePlayerState* Racer = Pair.Key.Get();
		if (Racer == nullptr)
		{
			continue;
		}

		NairobiRacing::Core::FStandingInput Input;
		Input.Id = Racer->GetPlayerId();
		Input.Lap = Pair.Value.Progress.Lap;
		Input.CompletedCheckpoints = Pair.Value.Progress.NextCheckpointIndex;
		Input.bFinished = Pair.Value.Progress.bFinished;
		Input.FinishTimeSeconds = Racer->GetFinishTimeSeconds();

		if (TrackData->Checkpoints.IsValidIndex(Pair.Value.Progress.NextCheckpointIndex))
		{
			const FNairobiCheckpointRow& NextGate = TrackData->Checkpoints[Pair.Value.Progress.NextCheckpointIndex];
			const FVector GateLocation(NextGate.CenterX, NextGate.CenterY, 0.0);
			Input.DistanceToNextGateMeters = FVector::Dist2D(Racer->GetPawn() ? Racer->GetPawn()->GetActorLocation() : GateLocation, GateLocation) / 100.0;
		}

		RulesInputs.push_back(Input);
		Inputs.Emplace(Racer, Input);
	}

	const std::vector<int> Ordered = NairobiRacing::Core::ComputeRacePositions(RulesInputs);
	for (int32 Index = 0; Index < static_cast<int32>(Ordered.size()); ++Index)
	{
		for (const TPair<ANairobiRacePlayerState*, NairobiRacing::Core::FStandingInput>& Entry : Inputs)
		{
			if (Entry.Value.Id == Ordered[static_cast<std::size_t>(Index)] && Entry.Key != nullptr)
			{
				Entry.Key->SetRacePosition(Index + 1);
				break;
			}
		}
	}
}

TArray<FNairobiRaceResult> ANairobiRaceManager::BuildResults() const
{
	TArray<FNairobiRaceResult> Results;
	if (!HasAuthority())
	{
		return Results;
	}

	FScopeLock Lock(&ProgressLock);

	std::vector<NairobiRacing::Core::FStandingInput> Inputs;
	TMap<int32, ANairobiRacePlayerState*> ById;
	for (const TPair<TWeakObjectPtr<ANairobiRacePlayerState>, FNairobiRacerRuntime>& Pair : RacerProgress)
	{
		ANairobiRacePlayerState* Racer = Pair.Key.Get();
		if (Racer == nullptr)
		{
			continue;
		}

		NairobiRacing::Core::FStandingInput Input;
		Input.Id = Racer->GetPlayerId();
		Input.Lap = Pair.Value.Progress.Lap;
		Input.CompletedCheckpoints = Pair.Value.Progress.NextCheckpointIndex;
		Input.bFinished = Pair.Value.Progress.bFinished;
		Input.FinishTimeSeconds = Racer->GetFinishTimeSeconds();
		Inputs.push_back(Input);
		ById.Add(Input.Id, Racer);
	}

	const std::vector<int> Ordered = NairobiRacing::Core::ComputeRacePositions(Inputs);
	for (int32 Position = 0; Position < static_cast<int32>(Ordered.size()); ++Position)
	{
		ANairobiRacePlayerState* Racer = ById.FindRef(Ordered[static_cast<std::size_t>(Position)]);
		if (Racer == nullptr)
		{
			continue;
		}

		FNairobiRaceResult Result;
		Result.FinishPosition = Position + 1;
		Result.PlayerId = FString::FromInt(Racer->GetPlayerId());
		Result.DisplayName = Racer->GetPlayerName();
		Result.VehicleId = Racer->GetVehicleId();
		Result.TotalTimeSeconds = Racer->GetFinishTimeSeconds();
		Result.BestLapSeconds = Racer->GetBestLapSeconds();
		Result.LapsCompleted = Racer->GetLapsCompleted();
		Result.bValidated = Racer->HasFinished();
		Result.bDisconnected = Racer->GetPawn() == nullptr;
		Results.Add(Result);
	}
	return Results;
}

bool ANairobiRaceManager::AreAllRacersFinished() const
{
	FScopeLock Lock(&ProgressLock);
	if (RacerProgress.Num() == 0)
	{
		return false;
	}
	for (const TPair<TWeakObjectPtr<ANairobiRacePlayerState>, FNairobiRacerRuntime>& Pair : RacerProgress)
	{
		if (Pair.Key.IsValid() && !Pair.Value.Progress.bFinished)
		{
			return false;
		}
	}
	return true;
}

void ANairobiRaceManager::LogAudit(const FString& Event, ANairobiRacePlayerState* Racer, const FString& Detail) const
{
	// Structured, greppable audit trail for competitive events. Ships to server logs
	// only; never contains secrets or client-supplied times.
	UE_LOG(LogNairobiRace, Log, TEXT("AUDIT event=%s playerId=%d player=%s %s"),
		*Event,
		Racer ? Racer->GetPlayerId() : -1,
		Racer ? *Racer->GetPlayerName() : TEXT("unknown"),
		*Detail);
}
