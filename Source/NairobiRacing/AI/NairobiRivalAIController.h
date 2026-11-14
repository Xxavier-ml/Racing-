#pragma once

#include "CoreMinimal.h"
#include "AIController.h"
#include "Core/NairobiTypes.h"
#include "NairobiRivalAIController.generated.h"

class ANairobiRaceVehiclePawn;
class UNairobiRaceTrackData;

/**
 * Racing-line AI driver.
 *
 * Opponents are real Chaos vehicles driven through the same input path as the player;
 * they are never teleported to fake competitiveness. Steering uses a kinematic pure
 * pursuit on the racing line, speed targets come from measured corner curvature, and
 * mistakes/stuck states feed a recovery routine.
 */
UCLASS()
class NAIROBIRACING_API ANairobiRivalAIController : public AAIController
{
	GENERATED_BODY()

public:
	ANairobiRivalAIController();

	virtual void BeginPlay() override;
	virtual void OnPossess(APawn* InPawn) override;
	virtual void Tick(float DeltaSeconds) override;

	/** 0.85 = cautious, 1.0 = reference pace. Set per rival from the race roster. */
	UFUNCTION(BlueprintCallable, Category = "AI")
	void ConfigureSkill(float InSkill01, float InLaneBiasCm, int32 InGridIndex);

	UFUNCTION(BlueprintPure, Category = "AI")
	float GetTargetSpeedKph() const { return TargetSpeedKph; }

protected:
	const UNairobiRaceTrackData* GetTrackData() const;
	void UpdateRacingLineIndex(const FVector& LocationCm);
	float ComputeCornerSpeedKph(const FVector& LocationCm, int32 AheadIndex) const;
	void ApplyInput(float Steering, float Throttle, float Brake, bool bHandbrake);

	UPROPERTY(EditDefaultsOnly, Category = "AI")
	float LookAheadDistanceCm = 2200.f;

	UPROPERTY(EditDefaultsOnly, Category = "AI")
	float SteeringGain = 1.55f;

	UPROPERTY(EditDefaultsOnly, Category = "AI")
	float CornerSpeedGainKph = 1.0f;

	UPROPERTY(EditDefaultsOnly, Category = "AI")
	float StuckRecoverySeconds = 3.5f;

	UPROPERTY(EditDefaultsOnly, Category = "AI")
	float OvertakeCheckDistanceCm = 1400.f;

	int32 RacingLineIndex = 0;
	float Skill01 = 0.95f;
	float LaneBiasCm = 0.f;
	float TargetSpeedKph = 0.f;
	float StuckSeconds = 0.f;
	float RecoveryCooldownSeconds = 0.f;
	bool bRecoveryPending = false;
};
