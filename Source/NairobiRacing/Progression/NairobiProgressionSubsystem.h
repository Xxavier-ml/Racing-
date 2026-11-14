#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "Core/NairobiTypes.h"
#include "NairobiProgressionSubsystem.generated.h"

/**
 * Local progression: XP, driver level and completion counters.
 *
 * Awards are computed from classified race results. In a networked race only results the
 * server marked validated may award progression (ENairobiRaceResult::bValidated), which
 * keeps cheated finishes out of local progression as well as the backend.
 */
UCLASS()
class NAIROBIRACING_API UNairobiProgressionSubsystem : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	UFUNCTION(BlueprintCallable, Category = "Progression")
	int32 AwardRaceResult(const FNairobiRaceResult& Result);

	UFUNCTION(BlueprintPure, Category = "Progression")
	int32 GetExperiencePoints() const { return ExperiencePoints; }

	UFUNCTION(BlueprintPure, Category = "Progression")
	int32 GetDriverLevel() const;

	UFUNCTION(BlueprintPure, Category = "Progression")
	float GetLevelProgress01() const;

	static int32 ComputeRaceXp(const FNairobiRaceResult& Result);

protected:
	UPROPERTY()
	int32 ExperiencePoints = 0;
};
