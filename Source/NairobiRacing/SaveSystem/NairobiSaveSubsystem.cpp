#include "SaveSystem/NairobiSaveSubsystem.h"

#include "Core/NairobiTrackRules.h"
#include "SaveSystem/NairobiProfileSaveGame.h"
#include "NairobiRacing.h"

#include "Kismet/GameplayStatics.h"

const FString UNairobiSaveSubsystem::SlotName = TEXT("NairobiRacingProfile");

void UNairobiSaveSubsystem::Initialize(FGameInstance* GameInstance)
{
	Super::Initialize(GameInstance);
	LoadOrCreateProfile();
}

void UNairobiSaveSubsystem::LoadOrCreateProfile()
{
	if (UGameplayStatics::DoesSaveGameExist(SlotName, 0))
	{
		Profile = Cast<UNairobiProfileSaveGame>(UGameplayStatics::LoadGameFromSlot(SlotName, 0));
	}

	if (Profile == nullptr)
	{
		Profile = Cast<UNairobiProfileSaveGame>(UGameplayStatics::CreateSaveGameObject(UNairobiProfileSaveGame::StaticClass()));
		UE_LOG(LogNairobiSave, Log, TEXT("No existing profile found; created a new default profile."));
		if (Profile)
		{
			SaveProfile();
		}
	}
}

bool UNairobiSaveSubsystem::SaveProfile()
{
	if (Profile == nullptr)
	{
		return false;
	}
	const bool bSaved = UGameplayStatics::SaveGameToSlot(Profile, SlotName, 0);
	if (!bSaved)
	{
		UE_LOG(LogNairobiSave, Error, TEXT("Failed to write save slot '%s'."), *SlotName);
	}
	return bSaved;
}

bool UNairobiSaveSubsystem::SaveSettings(
	const FNairobiGraphicsSettings& Graphics,
	const FNairobiAudioSettings& Audio,
	const FNairobiControlSettings& Controls)
{
	if (Profile == nullptr)
	{
		return false;
	}
	Profile->GraphicsSettings = Graphics;
	Profile->AudioSettings = Audio;
	Profile->ControlSettings = Controls;
	return SaveProfile();
}

bool UNairobiSaveSubsystem::SetSelectedVehicle(const FString& VehicleId)
{
	if (Profile == nullptr || VehicleId.IsEmpty())
	{
		return false;
	}
	Profile->SelectedVehicleId = VehicleId;
	return SaveProfile();
}

bool UNairobiSaveSubsystem::RecordLocalLap(const FNairobiLapRecord& Record, const TArray<FNairobiGhostSample>& GhostSamples)
{
	if (Profile == nullptr)
	{
		return false;
	}

	NairobiRacing::Core::FLapRecord RulesRecord;
	RulesRecord.PlayerId = Record.PlayerId.IsEmpty() ? TEXT("local-player") : TCHAR_TO_UTF8(*Record.PlayerId);
	RulesRecord.VehicleId = TCHAR_TO_UTF8(*Record.VehicleId);
	RulesRecord.LapTimeSeconds = Record.LapTimeSeconds;
	RulesRecord.TopSpeedKph = Record.TopSpeedKph;
	RulesRecord.DriftScore = Record.DriftScore;
	RulesRecord.RecordedAtIso = TCHAR_TO_UTF8(*Record.RecordedAtIso);

	if (!NairobiRacing::Core::IsValidLapRecord(RulesRecord))
	{
		UE_LOG(LogNairobiSave, Warning, TEXT("Rejected local lap record: invalid or implausible values."));
		return false;
	}

	// Migration of local records goes through the same ordering/trim rules as the
	// leaderboard UI, so a corrupted save cannot produce an unsorted table.
	std::vector<NairobiRacing::Core::FLapRecord> Existing;
	for (const FNairobiLapRecord& Saved : Profile->LocalBestLaps)
	{
		NairobiRacing::Core::FLapRecord Converted;
		Converted.PlayerId = TCHAR_TO_UTF8(*Saved.PlayerId);
		Converted.VehicleId = TCHAR_TO_UTF8(*Saved.VehicleId);
		Converted.LapTimeSeconds = Saved.LapTimeSeconds;
		Converted.TopSpeedKph = Saved.TopSpeedKph;
		Converted.DriftScore = Saved.DriftScore;
		Converted.RecordedAtIso = TCHAR_TO_UTF8(*Saved.RecordedAtIso);
		Existing.push_back(Converted);
	}

	const std::vector<NairobiRacing::Core::FLapRecord> Trimmed =
		NairobiRacing::Core::InsertLeaderboardRecord(Existing, RulesRecord, 5);

	Profile->LocalBestLaps.Reset();
	for (const NairobiRacing::Core::FLapRecord& Entry : Trimmed)
	{
		FNairobiLapRecord Saved;
		Saved.PlayerId = UTF8_TO_TCHAR(Entry.PlayerId.c_str());
		Saved.VehicleId = UTF8_TO_TCHAR(Entry.VehicleId.c_str());
		Saved.LapTimeSeconds = static_cast<float>(Entry.LapTimeSeconds);
		Saved.TopSpeedKph = static_cast<float>(Entry.TopSpeedKph);
		Saved.DriftScore = static_cast<float>(Entry.DriftScore);
		Saved.RecordedAtIso = UTF8_TO_TCHAR(Entry.RecordedAtIso.c_str());
		Profile->LocalBestLaps.Add(Saved);
	}

	if (Profile->BestLapSeconds <= 0.f || Record.LapTimeSeconds < Profile->BestLapSeconds)
	{
		Profile->BestLapSeconds = Record.LapTimeSeconds;
	}

	// Ghost: sanitise through the shared rules layer before persisting.
	std::vector<NairobiRacing::Core::FGhostSample> RawGhost;
	RawGhost.reserve(static_cast<std::size_t>(GhostSamples.Num()));
	for (const FNairobiGhostSample& Sample : GhostSamples)
	{
		NairobiRacing::Core::FGhostSample Converted;
		Converted.TimeSeconds = Sample.TimeSeconds;
		Converted.Position = NairobiRacing::Core::FVec2{ Sample.PositionCm.X / 100.0, Sample.PositionCm.Y / 100.0 };
		Converted.YawRadians = Sample.YawRadians;
		RawGhost.push_back(Converted);
	}

	const std::vector<NairobiRacing::Core::FGhostSample> CleanGhost =
		NairobiRacing::Core::SanitizeGhostSamples(RawGhost);

	const bool bGhostImproves = CleanGhost.size() >= 2
		&& (Profile->BestGhostLapSeconds <= 0.f || Record.LapTimeSeconds < Profile->BestGhostLapSeconds);

	if (bGhostImproves)
	{
		Profile->BestGhostSamples.Reset();
		for (const NairobiRacing::Core::FGhostSample& Sample : CleanGhost)
		{
			FNairobiGhostSample Converted;
			Converted.TimeSeconds = static_cast<float>(Sample.TimeSeconds);
			Converted.PositionCm = FVector2D(Sample.Position.X * 100.0, Sample.Position.Y * 100.0);
			Converted.YawRadians = static_cast<float>(Sample.YawRadians);
			Profile->BestGhostSamples.Add(Converted);
		}
		Profile->BestGhostLapSeconds = Record.LapTimeSeconds;
	}

	return SaveProfile();
}

void UNairobiSaveSubsystem::ResetProfile()
{
	UGameplayStatics::DeleteGameInSlot(SlotName, 0);
	Profile = nullptr;
	LoadOrCreateProfile();
	UE_LOG(LogNairobiSave, Log, TEXT("Local profile reset."));
}
