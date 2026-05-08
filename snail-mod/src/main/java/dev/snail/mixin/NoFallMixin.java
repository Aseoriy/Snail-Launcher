package dev.snail.mixin;

import dev.snail.module.ModuleManager;
import net.minecraft.client.network.ClientPlayerEntity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(ClientPlayerEntity.class)
public class NoFallMixin {

    @Inject(method = "tick", at = @At("HEAD"))
    private void onTick(CallbackInfo ci) {
        if (ModuleManager.INSTANCE.isEnabled("nofall")) {
            ClientPlayerEntity self = (ClientPlayerEntity) (Object) this;
            if (self.fallDistance > 2.5f) {
                self.setOnGround(true);
            }
        }
    }
}
