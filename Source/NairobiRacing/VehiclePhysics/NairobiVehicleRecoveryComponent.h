#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "NairobiVehicleRecoveryComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FNairobiVehicleStranded, bool, bStranded);

/**
 * Detects stranded vehicles (overturned, beached or stationary while throttle is held)
 * and exposes a single recovery entry point. The actual transform reset lives on the
 * pawn because it must be applied on the server and replicated to proxies.
 */
UCLASS(ClassGroup = (Nairobi), meta = (BlueprintSpawnableComponent))
class NAIROBIRACING_API UNairobiVehicleRecoveryComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UNairobiVehicleRecoveryComponent();

	virtual void BeginPlay() override;
	virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

	UFUNCTION(BlueprintPure, Category = "Recovery")
	bool IsStranded() const { return bStranded; }

	/** Throttle/RPM input hint so idle parking is not treated as being stuck. */
	void ReportDriverIntent(float Throttle, float SpeedKph);

	UFUNCTION(BlueprintPure, Category = "Recovery")
	float GetRecoveryCooldownRemaining() const { return RecoveryCooldownRemaining; }

	UPROPERTY(BlueprintAssignable, Category = "Recovery")
	FNairobiVehicleStranded OnStrandedChanged;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Recovery")
	float StrandedSpeedThresholdKph = 3.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Recovery")
	float StrandedAfterSeconds = 3.5f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Recovery")
	float RecoveryCooldownSeconds = 2.f;

protected:
	bool bStranded = false;
	float StationarySeconds = 0.f;
	float RecoveryCooldownRemaining = 0.f;
	float LastThrottle = 0.f;
};
