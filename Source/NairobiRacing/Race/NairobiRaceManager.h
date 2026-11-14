#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Core/NairobiTrackRules.h"
#include "Core/NairobiTypes.h"
#include "NairobiRaceManager.generated.h"

class ANairobiRacePlayerState;
class UNairobiRaceTrackData;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_ThreeParams(FNairobiRacerProgressed, ANairobiRacePlayerState*, Racer, int32, CheckpointIndex, int32, Lap);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FNairobiRacerFinished, ANairobiRacePlayerState*, Racer);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FNairobiCheckpointRejected, ANairobiRacePlayerState*, Racer, int32, CheckpointId);

/**
 * Server-only competitive authority.
 *
 * All checkpoint, lap, position and result decisions funnel through this actor, which
 * delegates the actual rules to NairobiRacing::Core (shared with the offline harness).
 * Clients send "I am at gate N at location L"; they never send times, positions or
 * completion. This class refuses to run without authority.
 */
UCLASS()
class NAIROBIRACING_API ANairobiRaceManager : public AActor
{
	GENERATED_BODY()

public:
	ANairobiRaceManager();

	virtual void BeginPlay() override;

	/** Must be called by the game mode before the race starts. */
	void InitializeRace(UNairobiRaceTrackData* InTrackData, int32 InTotalLaps, float InStartTimeSeconds);

	void RegisterRacer(ANairobiRacePlayerState* Racer);
	void UnregisterRacer(ANairobiRacePlayerState* Racer);

	/**
	 * Validates a checkpoint claim. WorldLocationCm is taken from the *server's*
	 * authoritative pawn transform, not from the RPC payload.
	 */
	bool SubmitCheckpoint(
		ANairobiRacePlayerState* Racer,
		int32 CheckpointId,
		const FVector& WorldLocationCm,
		float ServerRaceTimeSeconds);

	/** Called every server frame by the game mode with the authoritative race clock. */
	void UpdateStandings(float ServerRaceTimeSeconds);

	/** Records a validated ghost sample for the racer's current lap. */
	void RecordGhostSample(ANairobiRacePlayerState* Racer, const FVector& WorldLocationCm, float YawRadians, float ServerRaceTimeSeconds);

	TArray<FNairobiRaceResult> BuildResults() const;

	bool AreAllRacersFinished() const;

	UFUNCTION(BlueprintPure, Category = "Race")
	int32 GetRegisteredRacerCount() const { return RacerProgress.Num(); }

	UPROPERTY(BlueprintAssignable, Category = "Race")
	FNairobiRacerProgressed OnRacerProgressed;

	UPROPERTY(BlueprintAssignable, Category = "Race")
	FNairobiRacerFinished OnRacerFinished;

	UPROPERTY(BlueprintAssignable, Category = "Race")
	FNairobiCheckpointRejected OnCheckpointRejected;

protected:
	struct FNairobiRacerRuntime
	{
		NairobiRacing::Core::FRaceProgress Progress;
		std::vector<NairobiRacing::Core::FGhostSample> CurrentLapGhost;
		double LastGhostSampleTime = -1.0;
		double PenaltySeconds = 0.0;
	};

	/** Shared conversion from world cm to the rules layer's metre coordinates. */
	static NairobiRacing::Core::FVec2 ToRulesPosition(const FVector& WorldLocationCm);

	std::vector<NairobiRacing::Core::FCheckpointDefinition> BuildGateDefinitions() const;

	void HandleRacerCompletedLap(ANairobiRacePlayerState* Racer, FNairobiRacerRuntime& Runtime, double LapTimeSeconds, float ServerRaceTimeSeconds);
	void LogAudit(const FString& Event, ANairobiRacePlayerState* Racer, const FString& Detail) const;

	UPROPERTY()
	TObjectPtr<UNairobiRaceTrackData> TrackData;

	int32 TotalLaps = 3;
	float RaceStartTimeSeconds = 0.f;

	/** Non-UPROPERTY by design: racers are owned/replicated by the game state. */
	TMap<TWeakObjectPtr<ANairobiRacePlayerState>, FNairobiRacerRuntime> RacerProgress;

	mutable FCriticalSection ProgressLock;
};
