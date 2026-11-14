#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameStateBase.h"
#include "Core/NairobiTypes.h"
#include "NairobiRaceGameState.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FNairobiRacePhaseChanged, ENairobiRacePhase, NewPhase);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FNairobiCountdownChanged, int32, CountdownSeconds);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FNairobiRaceResultsReady);

/**
 * Replicated race clock and phase.
 *
 * Countdown and elapsed time are authored by ANairobiRaceGameMode on the server and
 * replicated here; clients never advance the official clock themselves. See
 * Documentation/Architecture/NETWORKING.md for the correction policy.
 */
UCLASS()
class NAIROBIRACING_API ANairobiRaceGameState : public AGameStateBase
{
	GENERATED_BODY()

public:
	ANairobiRaceGameState();

	virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;

	UFUNCTION(BlueprintPure, Category = "Race")
	ENairobiRacePhase GetRacePhase() const { return RacePhase; }

	UFUNCTION(BlueprintPure, Category = "Race")
	bool IsRaceRunning() const { return RacePhase == ENairobiRacePhase::Racing; }

	UFUNCTION(BlueprintPure, Category = "Race")
	float GetServerRaceTimeSeconds() const { return ServerRaceTimeSeconds; }

	UFUNCTION(BlueprintPure, Category = "Race")
	int32 GetCountdownSeconds() const { return CountdownSeconds; }

	UFUNCTION(BlueprintPure, Category = "Race")
	int32 GetConfiguredLaps() const { return ConfiguredLaps; }

	UFUNCTION(BlueprintPure, Category = "Race")
	FNairobiWeatherState GetWeatherState() const { return WeatherState; }

	UFUNCTION(BlueprintPure, Category = "Race")
	const TArray<FNairobiRaceResult>& GetResults() const { return Results; }

	/** Server-only mutators; guarded by HasAuthority() at every call site. */
	void SetRacePhase(ENairobiRacePhase NewPhase);
	void SetCountdownSeconds(int32 NewCountdown);
	void SetConfiguredLaps(int32 NewLaps);
	void SetWeatherState(const FNairobiWeatherState& NewWeather);
	void SetServerRaceTime(float NewTimeSeconds);
	void SetResults(const TArray<FNairobiRaceResult>& NewResults);

	UPROPERTY(BlueprintAssignable, Category = "Race")
	FNairobiRacePhaseChanged OnRacePhaseChanged;

	UPROPERTY(BlueprintAssignable, Category = "Race")
	FNairobiCountdownChanged OnCountdownChanged;

	UPROPERTY(BlueprintAssignable, Category = "Race")
	FNairobiRaceResultsReady OnRaceResultsReady;

protected:
	UFUNCTION()
	void OnRep_RacePhase();

	UFUNCTION()
	void OnRep_CountdownSeconds();

	UFUNCTION()
	void OnRep_Results();

	UPROPERTY(ReplicatedUsing = OnRep_RacePhase, BlueprintReadOnly, Category = "Race")
	ENairobiRacePhase RacePhase = ENairobiRacePhase::Lobby;

	UPROPERTY(ReplicatedUsing = OnRep_CountdownSeconds, BlueprintReadOnly, Category = "Race")
	int32 CountdownSeconds = 0;

	UPROPERTY(Replicated, BlueprintReadOnly, Category = "Race")
	float ServerRaceTimeSeconds = 0.f;

	UPROPERTY(Replicated, BlueprintReadOnly, Category = "Race")
	int32 ConfiguredLaps = 3;

	UPROPERTY(Replicated, BlueprintReadOnly, Category = "Race")
	FNairobiWeatherState WeatherState;

	UPROPERTY(ReplicatedUsing = OnRep_Results, BlueprintReadOnly, Category = "Race")
	TArray<FNairobiRaceResult> Results;
};
