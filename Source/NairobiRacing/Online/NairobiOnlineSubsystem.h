#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "Core/NairobiTypes.h"
#include "NairobiOnlineSubsystem.generated.h"

UENUM(BlueprintType)
enum class ENairobiOnlineStatus : uint8
{
	Offline,
	SigningIn,
	Online,
	InSession,
	Error
};

/**
 * Online service boundary.
 *
 * This class is the single place the game talks to an online backend. It intentionally
 * contains NO backend implementation yet: competitive multiplayer is a Gate 5 deliverable
 * and the provider decision is recorded in Documentation/Architecture/NETWORKING.md.
 *
 * Architectural rules already encoded here:
 *  - the client never holds service credentials or admin keys;
 *  - the client never submits an official lap time directly - it reports inputs/claims to
 *    the dedicated server, which validates and is the only writer of official records;
 *  - a failed/absent backend degrades to offline play instead of blocking the game.
 */
UCLASS()
class NAIROBIRACING_API UNairobiOnlineSubsystem : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	virtual void Initialize(FGameInstance* GameInstance) override;

	UFUNCTION(BlueprintCallable, Category = "Online")
	bool BeginSignIn();

	UFUNCTION(BlueprintCallable, Category = "Online")
	bool CreateRaceSession(int32 MaxPlayers);

	UFUNCTION(BlueprintCallable, Category = "Online")
	bool FindAndJoinRaceSession();

	UFUNCTION(BlueprintCallable, Category = "Online")
	bool LeaveRaceSession();

	/**
	 * Client-side request for an official record. Deliberately not a direct upload:
	 * it forwards to the authoritative server, which owns validation and submission.
	 */
	UFUNCTION(BlueprintCallable, Category = "Online")
	bool RequestOfficialLapSubmission(const FNairobiLapRecord& Record);

	UFUNCTION(BlueprintPure, Category = "Online")
	ENairobiOnlineStatus GetStatus() const { return Status; }

	UFUNCTION(BlueprintPure, Category = "Online")
	FString GetLastError() const { return LastError; }

	UFUNCTION(BlueprintPure, Category = "Online")
	bool IsOnlinePlayAvailable() const { return Status == ENairobiOnlineStatus::Online || Status == ENairobiOnlineStatus::InSession; }

	static constexpr int32 MaxSupportedPlayers = 12;

protected:
	bool FailUnavailable(const FString& Operation);

	UPROPERTY()
	ENairobiOnlineStatus Status = ENairobiOnlineStatus::Offline;

	UPROPERTY()
	FString LastError;
};
