#include "Online/NairobiOnlineSubsystem.h"

#include "NairobiRacing.h"

void UNairobiOnlineSubsystem::Initialize(FGameInstance* GameInstance)
{
	Super::Initialize(GameInstance);
	Status = ENairobiOnlineStatus::Offline;
	LastError.Reset();
	UE_LOG(LogNairobiOnline, Log,
		TEXT("Online subsystem initialised in offline mode. No provider is configured; see Documentation/Architecture/NETWORKING.md."));
}

bool UNairobiOnlineSubsystem::FailUnavailable(const FString& Operation)
{
	LastError = FString::Printf(TEXT("%s is unavailable: no online provider is configured."), *Operation);
	Status = ENairobiOnlineStatus::Error;
	UE_LOG(LogNairobiOnline, Warning, TEXT("%s"), *LastError);
	return false;
}

bool UNairobiOnlineSubsystem::BeginSignIn()
{
	return FailUnavailable(TEXT("Sign-in"));
}

bool UNairobiOnlineSubsystem::CreateRaceSession(int32 MaxPlayers)
{
	if (MaxPlayers < 2 || MaxPlayers > MaxSupportedPlayers)
	{
		LastError = FString::Printf(TEXT("Requested player limit %d is outside the supported range 2..%d."), MaxPlayers, MaxSupportedPlayers);
		Status = ENairobiOnlineStatus::Error;
		return false;
	}
	return FailUnavailable(TEXT("Race session creation"));
}

bool UNairobiOnlineSubsystem::FindAndJoinRaceSession()
{
	return FailUnavailable(TEXT("Matchmaking"));
}

bool UNairobiOnlineSubsystem::LeaveRaceSession()
{
	Status = ENairobiOnlineStatus::Offline;
	return true;
}

bool UNairobiOnlineSubsystem::RequestOfficialLapSubmission(const FNairobiLapRecord& Record)
{
	// Guard rail: official records may only be written after server validation.
	if (Record.LapTimeSeconds <= 0.f)
	{
		LastError = TEXT("Refusing to submit a non-positive lap time.");
		return false;
	}
	return FailUnavailable(TEXT("Official lap submission"));
}
