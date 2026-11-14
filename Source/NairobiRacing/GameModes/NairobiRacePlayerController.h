#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerController.h"
#include "Core/NairobiTypes.h"
#include "NairobiRacePlayerController.generated.h"

class ANairobiRaceVehiclePawn;
class UInputAction;
class UInputMappingContext;

/**
 * Player input and client-side presentation for a racer.
 *
 * Input is gathered here and forwarded to the controlled vehicle. Authoritative state
 * (checkpoints, lap times, results) still comes from the server; this controller only
 * predicts feel locally. Enhanced Input assets are optional so the project stays
 * playable with the legacy axis mappings in Config/DefaultInput.ini before any input
 * assets are authored.
 */
UCLASS()
class NAIROBIRACING_API ANairobiRacePlayerController : public APlayerController
{
	GENERATED_BODY()

public:
	ANairobiRacePlayerController();

	virtual void BeginPlay() override;
	virtual void SetupInputComponent() override;
	virtual void PlayerTick(float DeltaTime) override;
	virtual void OnPossess(APawn* InPawn) override;

	/** Server -> client: show the classified results screen. */
	UFUNCTION(Client, Reliable)
	void Client_ShowRaceResults(const TArray<FNairobiRaceResult>& Results);

	/** Server -> client: race is restarting, clear local race UI state. */
	UFUNCTION(Client, Reliable)
	void Client_PrepareRestart();

	UFUNCTION(Client, Reliable)
	void Client_NotifyCheckpointRejected(int32 CheckpointId);

	/** Server RPC: ask for a safe reset to the nearest road (recovery). */
	UFUNCTION(Server, Reliable)
	void Server_RequestVehicleRecovery();

	UFUNCTION(Server, Reliable)
	void Server_SetReady(bool bReady);

	UFUNCTION(BlueprintPure, Category = "Input")
	ENairobiCameraMode GetCameraMode() const { return CameraMode; }

	UFUNCTION(BlueprintCallable, Category = "Input")
	void CycleCameraMode();

	UFUNCTION(BlueprintCallable, Category = "Input")
	void TogglePauseMenu();

protected:
	ANairobiRaceVehiclePawn* GetRaceVehicle() const;

	// Legacy axis/action handlers (Config/DefaultInput.ini).
	void OnThrottleAxis(float Value);
	void OnSteerAxis(float Value);
	void OnHandbrakePressed();
	void OnHandbrakeReleased();
	void OnBoostPressed();
	void OnBoostReleased();
	void OnRecoverPressed();
	void OnCameraPressed();
	void OnPausePressed();
	void OnLookBackPressed();
	void OnLookBackReleased();

	void PushInputToVehicle();

	/** Optional Enhanced Input assets; when unset the legacy mappings are used. */
	UPROPERTY(EditDefaultsOnly, Category = "Input|Enhanced")
	TObjectPtr<UInputMappingContext> DrivingMappingContext;

	UPROPERTY(EditDefaultsOnly, Category = "Input|Enhanced")
	TObjectPtr<UInputAction> ThrottleAction;

	UPROPERTY(EditDefaultsOnly, Category = "Input|Enhanced")
	TObjectPtr<UInputAction> SteerAction;

	UPROPERTY(EditDefaultsOnly, Category = "Input|Enhanced")
	TObjectPtr<UInputAction> BrakeAction;

	UPROPERTY(EditDefaultsOnly, Category = "Input|Enhanced")
	TObjectPtr<UInputAction> HandbrakeAction;

	UPROPERTY(EditDefaultsOnly, Category = "Input|Enhanced")
	TObjectPtr<UInputAction> BoostAction;

	FNairobiDriverInput CachedInput;

	ENairobiCameraMode CameraMode = ENairobiCameraMode::Chase;

	bool bPauseMenuOpen = false;
	bool bLookBackHeld = false;
};
