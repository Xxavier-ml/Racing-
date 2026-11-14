#pragma once

#include "CoreMinimal.h"
#include "WheeledVehiclePawn.h"
#include "Core/NairobiTypes.h"
#include "NairobiRaceVehiclePawn.generated.h"

class UBoxComponent;
class UNairobiCameraRigComponent;
class UNairobiNitroComponent;
class UNairobiVehicleAudioComponent;
class UNairobiVehicleConfiguration;
class UNairobiVehicleRecoveryComponent;

/**
 * The player/AI Chaos vehicle.
 *
 * Physics runs on Chaos (four wheels, suspension, tyre slip, engine/gearbox); this class
 * only translates intent into Chaos inputs, owns presentation components and routes
 * checkpoint crossings to the server. It deliberately contains no arcade movement math:
 * the legacy prototype's horizontal-plane integrator is NOT reimplemented here.
 */
UCLASS()
class NAIROBIRACING_API ANairobiRaceVehiclePawn : public AWheeledVehiclePawn
{
	GENERATED_BODY()

public:
	ANairobiRaceVehiclePawn();

	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;
	virtual void NotifyHit(
		UPrimitiveComponent* MyComp,
		AActor* Other,
		UPrimitiveComponent* OtherComp,
		bool bSelfMoved,
		FVector HitLocation,
		FVector HitNormal,
		FVector NormalImpulse,
		const FHitResult& Hit) override;

	/** Applies driver intent locally and forwards it to the server when needed. */
	void ApplyDriverInput(const FNairobiDriverInput& Input);

	/** Race lock: holds the car on the grid and ignores input outside Racing. */
	void SetRaceControlEnabled(bool bEnabled);

	UFUNCTION(BlueprintPure, Category = "Vehicle")
	bool IsRaceControlEnabled() const { return bRaceControlEnabled; }

	/** Server-only: teleports to the nearest point of the racing line, facing forward. */
	UFUNCTION(BlueprintCallable, Category = "Vehicle")
	void RecoverToNearestRoad();

	UFUNCTION(Server, Reliable)
	void Server_SubmitCheckpoint(int32 CheckpointId);

	UFUNCTION(BlueprintPure, Category = "Vehicle")
	float GetSpeedKph() const;

	UFUNCTION(BlueprintPure, Category = "Vehicle")
	float GetEngineRPM() const;

	UFUNCTION(BlueprintPure, Category = "Vehicle")
	FString GetGearText() const;

	UFUNCTION(BlueprintPure, Category = "Vehicle")
	float GetNitroCapacity01() const;

	UFUNCTION(BlueprintPure, Category = "Vehicle")
	float GetSteeringAngleDegrees() const { return SteeringAngleDegrees; }

	/** Presentation hook for the wheel AnimBP (degrees, per wheel). */
	UFUNCTION(BlueprintPure, Category = "Vehicle|Animation")
	float GetWheelSpinDegrees(int32 WheelIndex) const;

	UFUNCTION(BlueprintPure, Category = "Vehicle")
	UNairobiCameraRigComponent* GetCameraRig() const { return CameraRig; }

	UFUNCTION(BlueprintPure, Category = "Vehicle")
	UNairobiNitroComponent* GetNitroComponent() const { return NitroComponent; }

	UFUNCTION(BlueprintPure, Category = "Vehicle")
	const FNairobiDriverInput& GetLastDriverInput() const { return LastInput; }

	/** Weather subsystem calls this when conditions change (grip affects handling). */
	UFUNCTION(BlueprintCallable, Category = "Vehicle")
	void ApplySurfaceGrip(float GripMultiplier);

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Vehicle")
	TObjectPtr<UNairobiVehicleConfiguration> VehicleConfiguration;

protected:
	UFUNCTION()
	void HandleCheckpointOverlap(
		UPrimitiveComponent* OverlappedComponent,
		AActor* OtherActor,
		UPrimitiveComponent* OtherComp,
		int32 OtherBodyIndex,
		bool bFromSweep,
		const FHitResult& SweepResult);

	UFUNCTION(Server, Unreliable)
	void Server_SetDriverInput(FNairobiDriverInput Input);

	void ApplyInputToChaos(const FNairobiDriverInput& Input);
	void HandleCheckpointOnAuthority(int32 CheckpointId);
	void UpdateWheelVisuals(float DeltaSeconds);

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Vehicle")
	TObjectPtr<UNairobiCameraRigComponent> CameraRig;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Vehicle")
	TObjectPtr<UNairobiNitroComponent> NitroComponent;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Vehicle")
	TObjectPtr<UNairobiVehicleRecoveryComponent> RecoveryComponent;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Vehicle")
	TObjectPtr<UNairobiVehicleAudioComponent> VehicleAudioComponent;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Vehicle")
	TObjectPtr<UBoxComponent> CheckpointProbe;

	FNairobiDriverInput LastInput;
	float SteeringAngleDegrees = 0.f;
	float WheelSpinDegrees[4] = { 0.f, 0.f, 0.f, 0.f };
	float InputSendAccumulator = 0.f;
	float LastImpactSpeedKph = 0.f;
	float CurrentSurfaceGrip = 1.f;
	bool bRaceControlEnabled = true;
};
