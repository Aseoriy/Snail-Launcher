package dev.snail;

import dev.snail.gui.SnailScreen;
import dev.snail.module.ModuleManager;
import net.fabricmc.api.ClientModInitializer;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.util.InputUtil;
import org.lwjgl.glfw.GLFW;

public class SnailMod implements ClientModInitializer {

    public static final String MOD_ID = "snailmod";
    private static final ModuleManager modules = ModuleManager.INSTANCE;
    private static boolean wasMenuKeyDown = false;

    @Override
    public void onInitializeClient() {
        modules.init();
        System.out.println("[SnailMod] Loaded! Press RIGHT SHIFT to open the Snail Menu.");
    }

    /**
     * Called every client tick by ClientTickMixin.
     */
    public static void onClientTick(MinecraftClient mc) {
        // Direct GLFW key check — no KeyBinding registration needed
        long window = mc.getWindow().getHandle();
        boolean isDown = InputUtil.isKeyPressed(window, GLFW.GLFW_KEY_RIGHT_SHIFT);

        if (isDown && !wasMenuKeyDown) {
            if (mc.currentScreen == null) {
                mc.setScreen(new SnailScreen());
            } else if (mc.currentScreen instanceof SnailScreen) {
                mc.setScreen(null);
            }
        }
        wasMenuKeyDown = isDown;

        // Tick all enabled modules
        if (mc.player != null && mc.world != null && mc.currentScreen == null) {
            modules.onTick(mc);
        }
    }
}
