package dev.snail.gui;

import dev.snail.module.Module;
import dev.snail.module.ModuleManager;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.network.ClientPlayerEntity;
import net.minecraft.entity.effect.StatusEffectInstance;
import net.minecraft.item.ItemStack;
import net.minecraft.util.math.BlockPos;
import java.util.List;

public class HudOverlay {
    static final int BG = 0x80111111;

    public static void render(DrawContext ctx, MinecraftClient mc) {
        if (mc.player == null) return;
        int sw = mc.getWindow().getScaledWidth();
        int y = 4;

        // Active module list (top-right)
        List<Module> active = ModuleManager.INSTANCE.getModules().stream().filter(Module::isEnabled).toList();
        if (!active.isEmpty()) {
            for (Module m : active) {
                // Skip visual modules from the list (they render their own stuff)
                if (m.category.equals("Visual")) continue;
                int tw = mc.textRenderer.getWidth(m.name);
                int x = sw - tw - 8;
                ctx.fill(x - 4, y - 1, sw, y + 10, BG);
                ctx.fill(sw - 2, y - 1, sw, y + 10, m.color);
                ctx.drawText(mc.textRenderer, m.name, x, y, m.color, true);
                y += 12;
            }
        }

        // FPS Display (top-left)
        if (ModuleManager.INSTANCE.isEnabled("fps")) {
            String fps = mc.getCurrentFps() + " FPS";
            ctx.fill(3, 3, 8 + mc.textRenderer.getWidth(fps), 15, BG);
            ctx.drawText(mc.textRenderer, fps, 6, 5, 0xFF89B4FA, true);
        }

        // Coordinates (below FPS)
        if (ModuleManager.INSTANCE.isEnabled("coords")) {
            ClientPlayerEntity p = mc.player;
            int cy = ModuleManager.INSTANCE.isEnabled("fps") ? 18 : 4;
            String coords = String.format("XYZ: %.1f / %.1f / %.1f", p.getX(), p.getY(), p.getZ());
            String facing = "Facing: " + getDirection(p.getYaw());
            ctx.fill(3, cy, 8 + mc.textRenderer.getWidth(coords), cy + 12, BG);
            ctx.drawText(mc.textRenderer, coords, 6, cy + 2, 0xFF89DCEB, true);
            ctx.fill(3, cy + 13, 8 + mc.textRenderer.getWidth(facing), cy + 25, BG);
            ctx.drawText(mc.textRenderer, facing, 6, cy + 15, 0xFF89DCEB, false);
        }

        // Armor HUD (bottom-left)
        if (ModuleManager.INSTANCE.isEnabled("armorhud")) {
            int ay = mc.getWindow().getScaledHeight() - 58;
            for (int i = 3; i >= 0; i--) {
                ItemStack stack = mc.player.getInventory().getArmorStack(i);
                if (!stack.isEmpty()) {
                    ctx.drawItem(stack, 4, ay);
                    if (stack.isDamageable()) {
                        int max = stack.getMaxDamage(), dmg = stack.getDamage();
                        int pct = (int)(100.0 * (max - dmg) / max);
                        int col = pct > 50 ? 0xFFA6E3A1 : pct > 25 ? 0xFFFAB387 : 0xFFF38BA8;
                        ctx.drawText(mc.textRenderer, pct + "%", 22, ay + 4, col, true);
                    }
                    ay -= 18;
                }
            }
        }

        // Potion timers (right side, below module list)
        if (ModuleManager.INSTANCE.isEnabled("potions")) {
            int py = y + 8;
            try {
                for (StatusEffectInstance effect : mc.player.getStatusEffects()) {
                    String name;
                    try {
                        // Use reflection — API differs between MC versions
                        Object type = effect.getEffectType();
                        var m2 = type.getClass().getMethod("getName");
                        name = ((net.minecraft.text.Text) m2.invoke(type)).getString();
                    } catch (Exception e2) { name = "Effect"; }
                    int amp = effect.getAmplifier() + 1;
                    int dur = effect.getDuration();
                    String time = String.format("%d:%02d", dur / 1200, (dur % 1200) / 20);
                    String line = name + " " + amp + " - " + time;
                    int tw = mc.textRenderer.getWidth(line);
                    int px = sw - tw - 8;
                    ctx.fill(px - 4, py - 1, sw, py + 10, BG);
                    ctx.drawText(mc.textRenderer, line, px, py, 0xFFCBA6F7, false);
                    py += 12;
                }
            } catch (Exception ignored) {}
        }
    }

    static String getDirection(float yaw) {
        yaw = ((yaw % 360) + 360) % 360;
        if (yaw >= 315 || yaw < 45) return "South";
        if (yaw >= 45 && yaw < 135) return "West";
        if (yaw >= 135 && yaw < 225) return "North";
        return "East";
    }
}
