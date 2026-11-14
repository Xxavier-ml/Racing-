#pragma once

#include "CoreMinimal.h"
#include "Subsystems/WorldSubsystem.h"
#include "Core/NairobiTypes.h"
#include "NairobiWeatherSubsystem.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FNairobiWeatherChanged, FNairobiWeatherState, NewState);

/**
 * Weather authority and world application.
 *
 * Gameplay weather is server-owned: during a networked race only the server may change
 * conditions, and the resulting FNairobiWeatherState is replicated through
 * ANairobiRaceGameState. Clients apply the visuals and grip, they never roll their own.
 *
 * Grip and braking multipliers come from the preserved prototype profiles
 * (clear 1.0 / rain 0.62 / fog 0.84) and are fed into Chaos tyre friction, so weather
 * changes handling and braking distance rather than only looking different.
 */
UCLASS()
class NAIROBIRACING_API UNairobiWeatherSubsystem : public UTickableWorldSubsystem
{
	GENERATED_BODY()

public:
	virtual bool ShouldCreateSubsystem(UObject* Outer) const override;
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;
	virtual void Tick(float DeltaTime) override;
	virtual TStatId GetStatId() const override;

	/** Pure mapping from condition to gameplay/presentation values. */
	static FNairobiWeatherState BuildWeatherState(ENairobiWeatherType Condition);

	UFUNCTION(BlueprintCallable, Category = "Weather")
	void SetWeather(ENairobiWeatherType NewCondition);

	UFUNCTION(BlueprintCallable, Category = "Weather")
	void CycleWeather();

	UFUNCTION(BlueprintPure, Category = "Weather")
	FNairobiWeatherState GetCurrentWeather() const { return CurrentWeather; }

	/** Applies fog, sun and skylight values for the current condition. */
	void ApplyWeatherToWorld();

	UPROPERTY(BlueprintAssignable, Category = "Weather")
	FNairobiWeatherChanged OnWeatherChanged;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Weather")
	bool bAutoCycleWeather = false;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Weather")
	float AutoCyclePeriodSeconds = 240.f;

protected:
	bool HasServerAuthority() const;

	FNairobiWeatherState CurrentWeather;
	float CycleAccumulator = 0.f;
};
