#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Core/NairobiTypes.h"
#include "NairobiTrafficManager.generated.h"

class ANairobiTrafficVehicle;
class UNairobiRaceTrackData;

USTRUCT()
struct FNairobiTrafficLaneAgent
{
	GENERATED_BODY()

	UPROPERTY()
	TObjectPtr<ANairobiTrafficVehicle> Vehicle;

	UPROPERTY()
	bool bNorthSouth = true;

	/** +1 = north on NS streets, east on EW streets. */
	UPROPERTY()
	int32 Direction = 1;

	/** Perpendicular centreline (Y for NS, X for EW), cm. */
	UPROPERTY()
	float FixAxisCm = 0.f;

	UPROPERTY()
	float LaneOffsetCm = 0.f;

	/** Position along the street axis, cm. */
	UPROPERTY()
	float AlongCm = 0.f;

	UPROPERTY()
	float MinAlongCm = 0.f;

	UPROPERTY()
	float MaxAlongCm = 0.f;

	UPROPERTY()
	float CurrentSpeedMps = 0.f;

	UPROPERTY()
	float VehicleLengthCm = 520.f;

	UPROPERTY()
	FString StreetName;
};

/**
 * Nairobi city-traffic director.
 *
 * Spawns pooled traffic archetypes along the migrated street network, applies left-hand
 * lane placement (Kenyan convention), obeys the shared traffic-signal cycle, keeps safe
 * following distances and suspends simulation beyond the activation radius. Traffic is
 * intentionally not server-authoritative: it is ambience, and never awards race time.
 */
UCLASS()
class NAIROBIRACING_API ANairobiTrafficManager : public AActor
{
	GENERATED_BODY()

public:
	ANairobiTrafficManager();

	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;

	/** Called by the game mode once the track asset is known. */
	UFUNCTION(BlueprintCallable, Category = "Traffic")
	void BuildTrafficFleet(const UNairobiRaceTrackData* TrackData);

	UFUNCTION(BlueprintPure, Category = "Traffic")
	int32 GetActiveVehicleCount() const;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Traffic")
	TSubclassOf<ANairobiTrafficVehicle> TrafficVehicleClass;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Traffic", meta = (ClampMin = "0", ClampMax = "6"))
	int32 VehiclesPerStreet = 2;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Traffic")
	float ActivationRadiusCm = 12000.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Traffic")
	bool bTrafficEnabled = true;

	/** Seconds into the shared 16 s signal cycle. Server/standalone only. */
	UPROPERTY(BlueprintReadOnly, Category = "Traffic")
	float SignalCycleSeconds = 0.f;

protected:
	void SpawnLaneAgentsForStreet(
		const FString& StreetName,
		bool bNorthSouth,
		float FixAxisCm,
		float StartAlongCm,
		float EndAlongCm,
		float WidthCm,
		int32 VehicleCount);

	bool IsSignalStopRequired(bool bNorthSouth, float AlongCm, int32 Direction) const;
	FVector ComputeAgentLocation(const FNairobiTrafficLaneAgent& Agent) const;

	UPROPERTY()
	TArray<FNairobiTrafficLaneAgent> Agents;

	/** Perpendicular coordinates of crossing streets, used for signal stop lines. */
	TArray<float> CrossingCoordinates;

	int32 NextArchetypeIndex = 0;
};
