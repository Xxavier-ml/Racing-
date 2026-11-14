#include "World/NairobiRaceTrackData.h"

float UNairobiRaceTrackData::ComputeRacingLineLengthMeters() const
{
	if (RacingLineCm.Num() < 2)
	{
		return 0.f;
	}

	double TotalCm = 0.0;
	for (int32 Index = 0; Index < RacingLineCm.Num(); ++Index)
	{
		const FVector& Current = RacingLineCm[Index];
		const FVector& Next = RacingLineCm[(Index + 1) % RacingLineCm.Num()];
		TotalCm += FVector::Dist2D(Current, Next);
	}
	return static_cast<float>(TotalCm / 100.0);
}

FVector UNairobiRaceTrackData::GetGridSlotLocation(int32 SlotIndex) const
{
	if (GridSlots.IsValidIndex(SlotIndex))
	{
		return GridSlots[SlotIndex].GetLocation();
	}
	return FreeDriveSpawnCm;
}

float UNairobiRaceTrackData::GetGridSlotYaw(int32 SlotIndex) const
{
	if (GridSlots.IsValidIndex(SlotIndex))
	{
		return GridSlots[SlotIndex].Rotator().Yaw * (PI / 180.0);
	}
	return SpawnYawRadians;
}

TArray<int32> UNairobiRaceTrackData::GetCheckpointOrder() const
{
	TArray<int32> Order;
	Order.Reserve(Checkpoints.Num());
	for (const FNairobiCheckpointRow& Checkpoint : Checkpoints)
	{
		Order.Add(Checkpoint.Id);
	}
	return Order;
}

bool UNairobiRaceTrackData::IsFinishLineCheckpoint(int32 CheckpointId) const
{
	for (const FNairobiCheckpointRow& Checkpoint : Checkpoints)
	{
		if (Checkpoint.Id == CheckpointId)
		{
			return Checkpoint.bIsFinishLine;
		}
	}
	return false;
}

int32 UNairobiRaceTrackData::FindNearestRacingLineIndex(const FVector& WorldLocationCm) const
{
	int32 BestIndex = INDEX_NONE;
	double BestDistanceSq = TNumericLimits<double>::Max();

	for (int32 Index = 0; Index < RacingLineCm.Num(); ++Index)
	{
		const double DistanceSq = FVector::DistSquared2D(RacingLineCm[Index], WorldLocationCm);
		if (DistanceSq < BestDistanceSq)
		{
			BestDistanceSq = DistanceSq;
			BestIndex = Index;
		}
	}
	return BestIndex;
}
