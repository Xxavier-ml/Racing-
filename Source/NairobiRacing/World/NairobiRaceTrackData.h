#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "Core/NairobiDataRows.h"
#include "NairobiRaceTrackData.generated.h"

class UNairobiRaceTrackData;

/**
 * Authoritative description of a Nairobi circuit.
 *
 * Designers author these as data assets in the editor; the migrated CSV tables are
 * the starting point (Content/Data/Track). Race rules, AI, traffic signals and the
 * procedural track builder all read from this asset so there is a single source of
 * track truth instead of hardcoded coordinates.
 */
UCLASS(BlueprintType)
class NAIROBIRACING_API UNairobiRaceTrackData : public UPrimaryDataAsset
{
	GENERATED_BODY()

public:
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Track")
	FText TrackName;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Track")
	FText District;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Track")
	int32 DefaultLaps = 3;

	/** Closed-loop racing line in world centimetres, ordered from the start line. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Track")
	TArray<FVector> RacingLineCm;

	/** Checkpoint gates in required order; the last entry is the finish line. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Track")
	TArray<FNairobiCheckpointRow> Checkpoints;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Track")
	TArray<FNairobiStreetRow> Streets;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Track")
	TArray<FNairobiLandmarkRow> Landmarks;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Track")
	TArray<FNairobiRoundaboutRow> Roundabouts;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Track")
	TArray<FNairobiCityBlockRow> CityBlocks;

	/** Starting grid transform; slot 0 is pole position. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Track")
	TArray<FTransform> GridSlots;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Track")
	FVector FreeDriveSpawnCm = FVector(5050.0, -16800.0, 120.0);

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Track")
	float SpawnYawRadians = 1.5707963f;

	/** Used by server lap-time plausibility validation. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Track|Validation")
	float TrackLengthMeters = 1326.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Track|Validation")
	float MinimumPlausibleLapSeconds = 20.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Track|Validation")
	float MaximumPlausibleLapSeconds = 900.f;

	/** Total circuit length in metres, computed from the closed racing line. */
	UFUNCTION(BlueprintPure, Category = "Track")
	float ComputeRacingLineLengthMeters() const;

	UFUNCTION(BlueprintPure, Category = "Track")
	FVector GetGridSlotLocation(int32 SlotIndex) const;

	UFUNCTION(BlueprintPure, Category = "Track")
	float GetGridSlotYaw(int32 SlotIndex) const;

	/** Strict order of checkpoint ids as stored on the asset. */
	UFUNCTION(BlueprintPure, Category = "Track")
	TArray<int32> GetCheckpointOrder() const;

	UFUNCTION(BlueprintPure, Category = "Track")
	bool IsFinishLineCheckpoint(int32 CheckpointId) const;

	/** Finds the racing-line index nearest to a world location (AI recovery/progress). */
	UFUNCTION(BlueprintPure, Category = "Track")
	int32 FindNearestRacingLineIndex(const FVector& WorldLocationCm) const;
};
