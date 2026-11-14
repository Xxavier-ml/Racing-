#pragma once

#include "CoreMinimal.h"
#include "Components/SceneComponent.h"
#include "Core/NairobiTypes.h"
#include "NairobiCameraRigComponent.generated.h"

class UCameraComponent;
class USpringArmComponent;
class UCameraShakeBase;

/**
 * Chase / bumper / hood / aerial / cockpit camera rig.
 *
 * Built in C++ so camera behaviour is covered by the same review as gameplay. Speed
 * feeds arm length and FOV; the spring arm provides collision avoidance against the
 * city geometry. Optional impact shake is started through the owning player controller.
 */
UCLASS(ClassGroup = (Nairobi), meta = (BlueprintSpawnableComponent))
class NAIROBIRACING_API UNairobiCameraRigComponent : public USceneComponent
{
	GENERATED_BODY()

public:
	UNairobiCameraRigComponent();

	virtual void BeginPlay() override;
	virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

	UFUNCTION(BlueprintCallable, Category = "Camera")
	void SetCameraMode(ENairobiCameraMode NewMode);

	UFUNCTION(BlueprintPure, Category = "Camera")
	ENairobiCameraMode GetCameraMode() const { return CurrentMode; }

	UFUNCTION(BlueprintCallable, Category = "Camera")
	void SetLookBack(bool bLookBack);

	UFUNCTION(BlueprintCallable, Category = "Camera")
	void TriggerImpactShake(float Magnitude01);

	UFUNCTION(BlueprintPure, Category = "Camera")
	UCameraComponent* GetCamera() const { return Camera; }

	/** Called by the pawn each frame with the authoritative speed. */
	void SetSpeedKph(float NewSpeedKph) { SpeedKph = FMath::Max(0.f, NewSpeedKph); }

protected:
	void ApplyModeSettings(bool bImmediate);

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Camera")
	TObjectPtr<USpringArmComponent> SpringArm;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Camera")
	TObjectPtr<UCameraComponent> Camera;

	UPROPERTY(EditDefaultsOnly, Category = "Camera")
	TSubclassOf<UCameraShakeBase> ImpactShakeClass;

	UPROPERTY(EditAnywhere, Category = "Camera")
	bool bSpeedSensitiveFraming = true;

	ENairobiCameraMode CurrentMode = ENairobiCameraMode::Chase;

	float SpeedKph = 0.f;
	float BaseArmLength = 620.f;
	float BaseFOV = 82.f;
	float BlendedArmLength = 620.f;
	float BlendedFOV = 82.f;
	float BlendedPitch = -12.f;
	bool bLookBack = false;
};
