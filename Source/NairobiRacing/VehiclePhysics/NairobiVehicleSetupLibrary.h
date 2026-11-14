#pragma once

#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "NairobiVehicleSetupLibrary.generated.h"

class UChaosWheeledVehicleMovementComponent;
class UNairobiVehicleConfiguration;

/**
 * Applies UNairobiVehicleConfiguration to a Chaos wheeled vehicle.
 *
 * All subsequent gameplay code talks to Chaos through this one entry point, so an
 * engine-version field rename is contained here rather than spread across the project.
 * Field names below match the UE 5.4+ ChaosVehicles API; verify against the installed
 * engine on the first editor compile (documented in Documentation/Architecture/RISKS.md).
 */
UCLASS()
class NAIROBIRACING_API UNairobiVehicleSetupLibrary : public UBlueprintFunctionLibrary
{
	GENERATED_BODY()

public:
	/**
	 * @param SurfaceGripMultiplier 1.0 dry tarmac, <1.0 wet, >1.0 sticky surface.
	 */
	UFUNCTION(BlueprintCallable, Category = "Vehicle|Setup")
	static void ApplyConfiguration(
		UChaosWheeledVehicleMovementComponent* Movement,
		const UNairobiVehicleConfiguration* Configuration,
		float SurfaceGripMultiplier = 1.f);

	/** Re-applies tyre grip only (weather changes call this, not the whole setup). */
	UFUNCTION(BlueprintCallable, Category = "Vehicle|Setup")
	static void ApplySurfaceGrip(
		UChaosWheeledVehicleMovementComponent* Movement,
		const UNairobiVehicleConfiguration* Configuration,
		float SurfaceGripMultiplier);

	/** Convenience: engine RPM as a 0..1 normalized value for audio/HUD. */
	UFUNCTION(BlueprintPure, Category = "Vehicle|Setup")
	static float GetNormalizedRPM(const UChaosWheeledVehicleMovementComponent* Movement, float IdleRPM, float MaxRPM);
};
