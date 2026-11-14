#pragma once

#include "CoreMinimal.h"
#include "GameFramework/HUD.h"
#include "NairobiHUD.generated.h"

class ANairobiRaceGameState;
class ANairobiRacePlayerState;
class ANairobiRaceVehiclePawn;

/**
 * Canvas HUD for the vertical slice.
 *
 * Implemented in C++ so speed/gear/lap/position/nitro readouts exist before UMG content
 * is authored. The polished menu, garage and results screens are UMG widgets added in
 * Gate 4; this HUD remains the in-race fallback and the source of truth for what the
 * widget layer must display.
 */
UCLASS()
class NAIROBIRACING_API ANairobiHUD : public AHUD
{
	GENERATED_BODY()

public:
	ANairobiHUD();

	virtual void DrawHUD() override;

	UPROPERTY(EditDefaultsOnly, Category = "HUD")
	bool bDrawTelemetryPanel = true;

protected:
	void DrawTelemetry(const ANairobiRaceVehiclePawn& Vehicle);
	void DrawRaceStatus(const ANairobiRaceGameState& RaceState, const ANairobiRacePlayerState* PlayerState);
	void DrawCountdown(const ANairobiRaceGameState& RaceState);
	void DrawResults(const ANairobiRaceGameState& RaceState);
	void DrawBar(float X, float Y, float Width, float Height, float Fill01, const FLinearColor& FillColour);
	void DrawLabel(const FString& Text, float X, float Y, const FLinearColor& Colour, float Scale = 1.f, bool bLargeFont = false);

	static FString FormatRaceTime(float Seconds);
};
