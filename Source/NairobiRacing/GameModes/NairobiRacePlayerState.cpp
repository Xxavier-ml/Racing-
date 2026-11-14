#include "GameModes/NairobiRacePlayerState.h"
#include "Net/UnrealNetwork.h"

ANairobiRacePlayerState::ANairobiRacePlayerState()
{
	bReplicates = true;
}

void ANairobiRacePlayerState::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
	Super::GetLifetimeReplicatedProps(OutLifetimeProps);

	DOREPLIFETIME(ANairobiRacePlayerState, NextCheckpointIndex);
	DOREPLIFETIME(ANairobiRacePlayerState, Lap);
	DOREPLIFETIME(ANairobiRacePlayerState, LapsCompleted);
	DOREPLIFETIME(ANairobiRacePlayerState, BestLapSeconds);
	DOREPLIFETIME(ANairobiRacePlayerState, bFinished);
	DOREPLIFETIME(ANairobiRacePlayerState, FinishTimeSeconds);
	DOREPLIFETIME(ANairobiRacePlayerState, RacePosition);
	DOREPLIFETIME(ANairobiRacePlayerState, VehicleId);
	DOREPLIFETIME(ANairobiRacePlayerState, bReady);
	DOREPLIFETIME(ANairobiRacePlayerState, LastRejectedCheckpointId);
}

void ANairobiRacePlayerState::SetRaceProgress(int32 InNextCheckpointIndex, int32 InLap, int32 InLapsCompleted, float InBestLap)
{
	if (!HasAuthority())
	{
		return;
	}
	NextCheckpointIndex = FMath::Max(0, InNextCheckpointIndex);
	Lap = FMath::Max(1, InLap);
	LapsCompleted = FMath::Max(0, InLapsCompleted);
	BestLapSeconds = FMath::Max(0.f, InBestLap);
	OnRep_Progress();
}

void ANairobiRacePlayerState::SetFinished(float InFinishTimeSeconds)
{
	if (!HasAuthority())
	{
		return;
	}
	bFinished = true;
	FinishTimeSeconds = FMath::Max(0.f, InFinishTimeSeconds);
}

void ANairobiRacePlayerState::SetRacePosition(int32 InPosition)
{
	if (HasAuthority())
	{
		RacePosition = FMath::Max(0, InPosition);
	}
}

void ANairobiRacePlayerState::SetVehicleId(const FString& InVehicleId)
{
	if (HasAuthority())
	{
		VehicleId = InVehicleId;
	}
}

void ANairobiRacePlayerState::SetReady(bool bInReady)
{
	if (!HasAuthority())
	{
		return;
	}
	bReady = bInReady;
}

void ANairobiRacePlayerState::SetLastRejectedCheckpoint(int32 CheckpointId)
{
	if (HasAuthority())
	{
		LastRejectedCheckpointId = CheckpointId;
	}
}

void ANairobiRacePlayerState::OnRep_Progress()
{
	OnCheckpointCleared.Broadcast(NextCheckpointIndex, Lap);
}
