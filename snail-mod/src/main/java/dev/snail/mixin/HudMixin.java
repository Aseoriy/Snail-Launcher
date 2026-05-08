package dev.snail.mixin;

import dev.snail.gui.HudOverlay;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.hud.InGameHud;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * Renders the SnailMod HUD overlay on top of the normal game HUD.
 * The render method signature varies between MC versions:
 * - 1.20.x: render(DrawContext, float)
 * - 1.21.x: render(DrawContext, RenderTickCounter)
 * We use require=0 so the mixin gracefully skips if signature doesn't match.
 */
@Mixin(InGameHud.class)
public class HudMixin {

    @Inject(method = "render(Lnet/minecraft/client/gui/DrawContext;F)V", at = @At("TAIL"), require = 0)
    private void onRender_1_20(DrawContext context, float tickDelta, CallbackInfo ci) {
        HudOverlay.render(context, MinecraftClient.getInstance());
    }
}
