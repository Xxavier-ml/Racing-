#pragma once

#include "CoreMinimal.h"
#include "Engine/DataTable.h"
#include "NairobiDataRows.generated.h"

/**
 * DataTable row types. Property names mirror the CSV headers emitted by
 * Tools/Migration/export_track_data.ts, so the generated tables import directly
 * (Content/Data/Track, Content/Data/Vehicles).
 */

USTRUCT(BlueprintType)
struct FNairobiCheckpointRow : public FTableRowBase
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Checkpoint")
	int32 Id = 0;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Checkpoint")
	double CenterX = 0.0;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Checkpoint")
	double CenterY = 0.0;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Checkpoint")
	double RadiusCm = 1600.0;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Checkpoint")
	bool bIsFinishLine = false;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Checkpoint")
	FString LandmarkId;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Checkpoint")
	int64 LatitudeE6 = 0;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Checkpoint")
	int64 LongitudeE6 = 0;
};

USTRUCT(BlueprintType)
struct FNairobiRacingLineRow : public FTableRowBase
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "RacingLine")
	int32 Order = 0;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "RacingLine")
	double X = 0.0;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "RacingLine")
	double Y = 0.0;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "RacingLine")
	FString CheckpointId;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "RacingLine")
	bool bIsFinishLine = false;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "RacingLine")
	float MaxSpeedKph = 45.f;
};

USTRUCT(BlueprintType)
struct FNairobiStreetRow : public FTableRowBase
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Street")
	FString DisplayName;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Street")
	FString SwahiliTag;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Street")
	bool bNorthSouth = true;

	/** Perpendicular centreline in cm: Y for north-south streets, X for east-west streets. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Street")
	double FixAxisCm = 0.0;

	/** Drivable span in cm along the street's axis (X for north-south, Y for east-west). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Street")
	double StartAlongCm = 0.0;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Street")
	double EndAlongCm = 0.0;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Street")
	double WidthCm = 1800.0;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Street")
	bool bHasMedian = false;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Street")
	float SpeedLimitKph = 50.f;
};

USTRUCT(BlueprintType)
struct FNairobiLandmarkRow : public FTableRowBase
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Landmark")
	FString DisplayName;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Landmark")
	FString ShortName;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Landmark")
	FString District;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Landmark")
	double X = 0.0;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Landmark")
	double Y = 0.0;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Landmark")
	double WaypointX = 0.0;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Landmark")
	double WaypointY = 0.0;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Landmark")
	double ColliderHalfWCm = 0.0;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Landmark")
	double ColliderHalfDCm = 0.0;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Landmark")
	double HeightCm = 0.0;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Landmark")
	int64 LatitudeE6 = 0;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Landmark")
	int64 LongitudeE6 = 0;
};

USTRUCT(BlueprintType)
struct FNairobiRoundaboutRow : public FTableRowBase
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Roundabout")
	FString DisplayName;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Roundabout")
	double X = 0.0;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Roundabout")
	double Y = 0.0;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Roundabout")
	double OuterRadiusCm = 2100.0;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Roundabout")
	double IslandRadiusCm = 850.0;
};

USTRUCT(BlueprintType)
struct FNairobiCityBlockRow : public FTableRowBase
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "City")
	FString DisplayLabel;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "City")
	double X = 0.0;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "City")
	double Y = 0.0;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "City")
	double HalfWidthCm = 0.0;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "City")
	double HalfDepthCm = 0.0;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "City")
	double HeightCm = 0.0;
};

/**
 * Vehicle tuning starting point migrated from the prototype presets.
 * LegacyMaxSpeedMps/LegacyAccel/LegacyHandling are informational only: gameplay
 * reads the Chaos-facing fields on UNairobiVehicleConfiguration, not these values.
 */
USTRUCT(BlueprintType)
struct FNairobiVehicleConfigRow : public FTableRowBase
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Vehicle")
	FString DisplayName;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Vehicle")
	FString Subtitle;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Vehicle")
	FString Plate;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Vehicle")
	FString LegacyPresetId;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Vehicle")
	float TopSpeedKph = 200.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Vehicle")
	float LegacyMaxSpeedMps = 55.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Vehicle")
	float LegacyAccel = 40.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Vehicle")
	float LegacyHandling = 2.8f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Vehicle")
	float LegacyDriftGrip = 0.85f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Vehicle")
	float SuggestedMassKg = 1500.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Vehicle")
	float SuggestedPeakTorqueNm = 600.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Vehicle")
	FString TuningStatus;
};
