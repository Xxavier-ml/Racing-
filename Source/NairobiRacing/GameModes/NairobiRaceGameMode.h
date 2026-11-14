#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "Core/NairobiTypes.h"
#include "NairobiRaceGameMode.generated.h"

class ANairobiRaceManager;
class ANairobiRacePlayerState;
class ANairobiRaceVehiclePawn;
class UNairobiRaceTrackData;

/**
 * Race director. Owns the countdown, the official race clock and race completion.
 *
 * Multiplayer policy: this class is server-authoritative and is intended to run on a
 * dedicated server for competitive sessions (see NETWORKING.md). Clients receive the
 * phase, clock and results through ANairobiRaceGameState.
 */
UCLASS()
class NAIROBIRACING_API ANairobiRaceGameMode : public AGameModeBase
{
	GENERATED_BODY()

public:
	ANairobiRaceGameMode();

	virtual void StartPlay() override;
	virtual void Tick(float DeltaSeconds) override;
	virtual void PostLogin(APlayerController* NewPlayer) override;
	virtual void Logout(AController* Exiting) override;
	virtual APawn* SpawnDefaultPawnFor_Implementation(AController* NewPlayer, AActor* StartSpot) override;

	UFUNCTION(BlueprintCallable, Category = "Race")
	void StartRaceCountdown();

	UFUNCTION(BlueprintCallable, Category = "Race")
	void BeginRace();

	UFUNCTION(BlueprintCallable, Category = "Race")
	void FinishRace();

	/** Server-only: resets progress and replays the countdown (restart / rematch). */
	UFUNCTION(BlueprintCallable, Category = "Race")
	void RestartRace();

	UFUNCTION(BlueprintPure, Category = "Race")
	ANairobiRaceManager* GetRaceManager() const { return RaceManager; }

	UFUNCTION(BlueprintPure, Category = "Race")
	UNairobiRaceTrackData* GetTrackData() const { return TrackData; }

	UFUNCTION(BlueprintPure, Category = "Race")
	ENairobiGameMode GetSelectedMode() const { return SelectedMode; }

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Race")
	TObjectPtr<UNairobiRaceTrackData> TrackData;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Race")
	ENairobiGameMode SelectedMode = ENairobiGameMode::Circuit;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Race", meta = (ClampMin = "1", ClampMax = "20"))
	int32 RaceLaps = 3;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Race", meta = (ClampMin = "0", ClampMax = "10"))
	int32 CountdownSeconds = 3;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Race")
	float MaximumRaceDurationSeconds = 900.f;

	/** AI opponents. 0 disables rivals (useful for solo testing). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Race|AI", meta = (ClampMin = "0", ClampMax = "11"))
	int32 RivalCount = 4;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Race|AI")
	TSubclassOf<ANairobiRaceVehiclePawn> RivalPawnClass;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Race")
	TSubclassOf<ANairobiRaceManager> RaceManagerClass;

protected:
	void InitializeRace();
	void OnCountdownTick();
	void RegisterRacer(APlayerController* NewPlayer);
	void ApplyRaceControlToVehicles(bool bEnabled) const;

	/** Server: spawns AI-driven Chaos vehicles on the grid, each with a player state. */
	void SpawnRivals();

	UPROPERTY()
	TArray<TObjectPtr<ANairobiRaceVehiclePawn>> RivalVehicles;

	UPROPERTY()
	TObjectPtr<ANairobiRaceManager> RaceManager;

	FTimerHandle CountdownTimerHandle;

	int32 RemainingCountdown = 0;
	float OfficialRaceClock = 0.f;
	bool bCountdownRunning = false;
	bool bRaceInitialized = false;
	int32 NextGridSlot = 0;
};
