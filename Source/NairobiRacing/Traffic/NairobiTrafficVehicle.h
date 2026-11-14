#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Pawn.h"
#include "Core/NairobiTypes.h"
#include "NairobiTrafficVehicle.generated.h"

class UBoxComponent;
class UStaticMeshComponent;

/**
 * A single city-traffic unit (matatu, boda boda, City Hoppa bus, saloon, safari).
 *
 * Traffic is intentionally kinematic and pooled: the city runs hundreds of vehicles, and
 * full Chaos simulation for all of them is not affordable. Vehicles close to the player
 * are the ones the manager keeps active; the rest are suspended. Collision still blocks
 * the player's vehicle, so impacts are physical from the player's point of view.
 */
UCLASS()
class NAIROBIRACING_API ANairobiTrafficVehicle : public APawn
{
	GENERATED_BODY()

public:
	ANairobiTrafficVehicle();

	virtual void Tick(float DeltaSeconds) override;

	void ActivateArchetype(ENairobiVehicleClass InArchetype);
	void SetSimulationActive(bool bActive);

	/** Advances along the current lane and returns the new world location. */
	void AdvanceAlongLane(const FVector& NewLocationCm, float NewYawRadians);

	UFUNCTION(BlueprintPure, Category = "Traffic")
	ENairobiVehicleClass GetArchetype() const { return Archetype; }

	UFUNCTION(BlueprintPure, Category = "Traffic")
	float GetCurrentSpeedMps() const { return CurrentSpeedMps; }

	void SetCurrentSpeedMps(float InSpeed) { CurrentSpeedMps = FMath::Max(0.f, InSpeed); }
	float GetBaseSpeedMps() const { return BaseSpeedMps; }
	void SetBaseSpeedMps(float InSpeed) { BaseSpeedMps = FMath::Max(0.f, InSpeed); }

	FString RouteNumber;

protected:
	void ApplyArchetypeVisuals();

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Traffic")
	TObjectPtr<UStaticMeshComponent> BodyMesh;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Traffic")
	TObjectPtr<UBoxComponent> CollisionBox;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Traffic")
	ENairobiVehicleClass Archetype = ENairobiVehicleClass::TrafficMatatu;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Traffic")
	float BaseSpeedMps = 15.f;

	float CurrentSpeedMps = 0.f;
	bool bSimulationActive = true;
};
