#include "Progression/NairobiProgressionSubsystem.h"

#include "SaveSystem/NairobiProfileSaveGame.h"
#include "SaveSystem/NairobiSaveSubsystem.h"
#include "NairobiRacing.h"

#include "Engine/GameInstance.h"

int32 UNairobiProgressionSubsystem::ComputeRaceXp(const FNairobiRaceResult& Result)
{
	if (Result.bDisconnected)
	{
		return 0;
	}

	// Position rewards dominate; finishing and laps completed keep it earned.
	const int32 PositionBonus = FMath::Max(0, 9 - Result.FinishPosition) * 60;
	const int32 FinishBonus = Result.LapsCompleted > 0 ? 120 : 0;
	const int32 LapBonus = FMath::Min(20, Result.LapsCompleted) * 15;
	return PositionBonus + FinishBonus + LapBonus;
}

int32 UNairobiProgressionSubsystem::AwardRaceResult(const FNairobiRaceResult& Result)
{
	if (!Result.bValidated)
	{
		UE_LOG(LogNairobiRace, Warning, TEXT("Refusing progression XP for an unvalidated result."));
		return 0;
	}

	const int32 Awarded = ComputeRaceXp(Result);
	ExperiencePoints += Awarded;

	if (UGameInstance* GameInstance = GetGameInstance())
	{
		if (UNairobiSaveSubsystem* Save = GameInstance->GetSubsystem<UNairobiSaveSubsystem>())
		{
			if (UNairobiProfileSaveGame* Profile = Save->GetProfile())
			{
				Profile->ExperiencePoints += Awarded;
				Profile->RacesCompleted += 1;
				Save->SaveProfile();
			}
		}
	}

	UE_LOG(LogNairobiRace, Log, TEXT("Progression: +%d XP (total %d, level %d)."), Awarded, ExperiencePoints, GetDriverLevel());
	return Awarded;
}

int32 UNairobiProgressionSubsystem::GetDriverLevel() const
{
	// 1,000 XP per level, capped so the HUD never displays nonsense.
	return FMath::Clamp(1 + ExperiencePoints / 1000, 1, 99);
}

float UNairobiProgressionSubsystem::GetLevelProgress01() const
{
	const int32 XpIntoLevel = ExperiencePoints % 1000;
	return static_cast<float>(XpIntoLevel) / 1000.f;
}
