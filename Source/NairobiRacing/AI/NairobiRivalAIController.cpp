#include "AI/NairobiRivalAIController.h"

#include "GameModes/NairobiRaceGameMode.h"
#include "GameModes/NairobiRaceGameState.h"
#include "Vehicles/NairobiRaceVehiclePawn.h"
#include "World/NairobiRaceTrackData.h"
#include "NairobiRacing.h"

#include "Engine/World.h"

ANairobiRivalAIController::ANairobiRivalAIController()
{
	PrimaryActorTick.bCanEverTick = true;
	PrimaryActorTick.TickInterval = 0.f;
	bWantsPlayerState = false;
}

void ANairobiRivalAIController::BeginPlay()
{
	Super::BeginPlay();
}

void ANairobiRivalAIController::OnPossess(APawn* InPawn)
{
	Super::OnPossess(InPawn);

	const ANairobiRaceVehiclePawn* Vehicle = Cast<ANairobiRaceVehiclePawn>(InPawn);
	if (Vehicle == nullptr)
	{
		UE_LOG(LogNairobiAI, Warning, TEXT("Rival controller possessed a non-race vehicle; AI will idle."));
		return;
	}

	if (const UNairobiRaceTrackData* Track = GetTrackData())
	{
		RacingLineIndex = FMath::Max(0, Track->FindNearestRacingLineIndex(Vehicle->GetActorLocation()));
	}
}

const UNairobiRaceTrackData* ANairobiRivalAIController::GetTrackData() const
{
	if (const UWorld* World = GetWorld())
	{
		if (const ANairobiRaceGameMode* GameMode = World->GetAuthGameMode<ANairobiRaceGameMode>())
		{
			return GameMode->GetTrackData();
		}
	}
	return nullptr;
}

void ANairobiRivalAIController::ConfigureSkill(float InSkill01, float InLaneBiasCm, int32 InGridIndex)
{
	Skill01 = FMath::Clamp(InSkill01, 0.6f, 1.05f);
	LaneBiasCm = FMath::Clamp(InLaneBiasCm, -300.f, 300.f);
	RacingLineIndex = FMath::Max(0, InGridIndex);
}

void ANairobiRivalAIController::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	ANairobiRaceVehiclePawn* Vehicle = Cast<ANairobiRaceVehiclePawn>(GetPawn());
	if (Vehicle == nullptr)
	{
		return;
	}

	const ANairobiRaceGameState* RaceState = GetWorld() ? GetWorld()->GetGameState<ANairobiRaceGameState>() : nullptr;
	if (RaceState == nullptr || !RaceState->IsRaceRunning())
	{
		ApplyInput(0.f, 0.f, 0.f, true);
		return;
	}

	const UNairobiRaceTrackData* Track = GetTrackData();
	if (Track == nullptr || Track->RacingLineCm.Num() < 4)
	{
		return;
	}

	const FVector Location = Vehicle->GetActorLocation();
	UpdateRacingLineIndex(Location);

	const FVector Target = Track->RacingLineCm[(RacingLineIndex + 2) % Track->RacingLineCm.Num()];
	const FVector ToTarget = (Target - Location).GetSafeNormal2D();
	const FVector Forward = Vehicle->GetActorForwardVector().GetSafeNormal2D();

	float Steering = 0.f;
	if (!ToTarget.IsNearlyZero() && !Forward.IsNearlyZero())
	{
		const float CrossZ = FVector::CrossProduct(Forward, ToTarget).Z;
		const float Dot = FVector::DotProduct(Forward, ToTarget);
		const float SignedAngle = FMath::Atan2(CrossZ, Dot);
		Steering = FMath::Clamp(SignedAngle * SteeringGain, -1.f, 1.f);
	}

	// Corner-based speed target: the sharper the upcoming bend, the lower the target.
	TargetSpeedKph = ComputeCornerSpeedKph(Location, (RacingLineIndex + 3) % Track->RacingLineCm.Num()) * Skill01;
	const float SpeedKph = Vehicle->GetSpeedKph();

	// Speed control. Overtaking/avoidance layers on top of the racing line in Gate 4;
	// the base controller must first be able to lap cleanly on its own.
	float Throttle = 0.f;
	float Brake = 0.f;
	if (SpeedKph < TargetSpeedKph - 4.f)
	{
		Throttle = FMath::Clamp((TargetSpeedKph - SpeedKph) / 35.f, 0.25f, 1.f);
	}
	else if (SpeedKph > TargetSpeedKph + 6.f)
	{
		Brake = FMath::Clamp((SpeedKph - TargetSpeedKph) / 40.f, 0.15f, 1.f);
	}
	else
	{
		Throttle = 0.35f;
	}

	ApplyInput(Steering, Throttle, Brake, false);

	// Stranded detection: held throttle but no movement means the AI has beached itself.
	if (Vehicle->GetSpeedKph() < 3.f && Throttle > 0.3f)
	{
		StuckSeconds += DeltaSeconds;
		if (StuckSeconds > StuckRecoverySeconds && RecoveryCooldownSeconds <= 0.f)
		{
			RecoveryCooldownSeconds = 6.f;
			StuckSeconds = 0.f;
			Vehicle->RecoverToNearestRoad();
			UE_LOG(LogNairobiAI, Verbose, TEXT("AI %s recovered to the racing line."), *Vehicle->GetName());
		}
	}
	else
	{
		StuckSeconds = 0.f;
	}

	RecoveryCooldownSeconds = FMath::Max(0.f, RecoveryCooldownSeconds - DeltaSeconds);
}

void ANairobiRivalAIController::UpdateRacingLineIndex(const FVector& LocationCm)
{
	const UNairobiRaceTrackData* Track = GetTrackData();
	if (Track == nullptr || Track->RacingLineCm.Num() == 0)
	{
		return;
	}

	// Search a forward window only: nearest-point search over the whole loop can snap
	// to a parallel street and make the AI drive backwards.
	const int32 Count = Track->RacingLineCm.Num();
	int32 BestIndex = RacingLineIndex;
	double BestDistanceSq = TNumericLimits<double>::Max();

	for (int32 Offset = 0; Offset < FMath::Min(12, Count); ++Offset)
	{
		const int32 Candidate = (RacingLineIndex - 2 + Offset + Count) % Count;
		const double DistanceSq = FVector::DistSquared2D(LocationCm, Track->RacingLineCm[Candidate]);
		if (DistanceSq < BestDistanceSq)
		{
			BestDistanceSq = DistanceSq;
			BestIndex = Candidate;
		}
	}

	RacingLineIndex = BestIndex;
}

float ANairobiRivalAIController::ComputeCornerSpeedKph(const FVector& LocationCm, int32 AheadIndex) const
{
	const UNairobiRaceTrackData* Track = GetTrackData();
	if (Track == nullptr || Track->RacingLineCm.Num() < 3)
	{
		return 120.f;
	}

	const int32 Count = Track->RacingLineCm.Num();
	const FVector& Current = Track->RacingLineCm[FMath::Clamp(AheadIndex, 0, Count - 1)];
	const FVector& Next = Track->RacingLineCm[(FMath::Clamp(AheadIndex, 0, Count - 1) + 1) % Count];

	const FVector Segment = (Next - Current).GetSafeNormal2D();
	const FVector Approach = (Current - LocationCm).GetSafeNormal2D();
	const float TurnRadians = FMath::Acos(FMath::Clamp(FVector::DotProduct(Approach, Segment), -1.f, 1.f));

	// 150 km/h on a straight, tapering to ~35 km/h for a right-angle corner.
	const float SpeedKph = 150.f / (1.f + TurnRadians * 2.4f);
	return FMath::Clamp(SpeedKph * CornerSpeedGainKph, 35.f, 180.f);
}

void ANairobiRivalAIController::ApplyInput(float Steering, float Throttle, float Brake, bool bHandbrake)
{
	if (ANairobiRaceVehiclePawn* Vehicle = Cast<ANairobiRaceVehiclePawn>(GetPawn()))
	{
		FNairobiDriverInput Input;
		Input.Steering = Steering;
		Input.Throttle = Throttle;
		Input.Brake = Brake;
		Input.bHandbrake = bHandbrake;
		Vehicle->ApplyDriverInput(Input);
	}
}
