#pragma once

#include "CoreMinimal.h"
#include "Components/AudioComponent.h"
#include "NairobiVehicleAudioComponent.generated.h"

class USoundBase;

/**
 * Layered, parameter-driven vehicle audio.
 *
 * A single looping engine sound is not acceptable for the target quality bar, so the
 * component drives *parameters* (RPM, load, speed, surface, horn) into a MetaSound
 * source or SoundCue that contains the layers: idle body, load harmonics, turbo, tyre
 * rolling, tyre squeal and wind. Beds for traffic/city ambience live on the traffic
 * manager and a separate ambience actor so they can be culled independently.
 */
UCLASS(ClassGroup = (Nairobi), meta = (BlueprintSpawnableComponent))
class NAIROBIRACING_API UNairobiVehicleAudioComponent : public UAudioComponent
{
	GENERATED_BODY()

public:
	UNairobiVehicleAudioComponent();

	virtual void BeginPlay() override;
	virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

	void SetEngineAudioProfile(TSoftObjectPtr<USoundBase> InLoopSound, TSoftObjectPtr<USoundBase> InOnLoadSound);

	/** Feeds the MetaSound parameters. Called by the vehicle pawn each frame. */
	void UpdateEngineParameters(float RPM01, float Load01, float SpeedKph, float Slip01);

	UFUNCTION(BlueprintCallable, Category = "Audio")
	void PlayHorn();

	UFUNCTION(BlueprintCallable, Category = "Audio")
	void SetHornSound(TSoftObjectPtr<USoundBase> InHornSound) { HornSound = InHornSound; }

	static const FName ParamRPM;
	static const FName ParamLoad;
	static const FName ParamSpeed;
	static const FName ParamTyreSlip;

protected:
	UPROPERTY(EditDefaultsOnly, Category = "Audio")
	TSoftObjectPtr<USoundBase> EngineLoopSound;

	UPROPERTY(EditDefaultsOnly, Category = "Audio")
	TSoftObjectPtr<USoundBase> EngineOnLoadSound;

	UPROPERTY(EditDefaultsOnly, Category = "Audio")
	TSoftObjectPtr<USoundBase> HornSound;

	UPROPERTY(Transient)
	TObjectPtr<UAudioComponent> HornComponent;

	bool bEngineAudioStarted = false;
};
