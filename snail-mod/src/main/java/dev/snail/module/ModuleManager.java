package dev.snail.module;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.ClientPlayerEntity;
import net.minecraft.entity.Entity;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.mob.HostileEntity;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.BlockItem;
import net.minecraft.util.Hand;
import net.minecraft.util.hit.BlockHitResult;
import net.minecraft.util.math.*;
import net.minecraft.block.Blocks;
import org.lwjgl.glfw.GLFW;
import java.io.*;
import java.nio.file.*;
import java.util.*;

public class ModuleManager {
    public static final ModuleManager INSTANCE = new ModuleManager();
    private final List<Module> modules = new ArrayList<>();
    private final Random rng = new Random();

    public void init() {
        // Combat
        modules.add(new AutoClicker());
        modules.add(new KillAura());
        // Movement
        modules.add(new AutoSprint());
        modules.add(new InfiniteJump());
        modules.add(new AutoCrouch());
        modules.add(new AutoBridge());
        // Player
        modules.add(new FastPlace());
        modules.add(new Fullbright());
        // Visual
        modules.add(new FPSDisplay());
        modules.add(new CoordDisplay());
        modules.add(new ArmorHUD());
        modules.add(new PotionTimer());

        loadConfig();
    }

    public List<Module> getModules() { return modules; }
    public boolean isEnabled(String id) { for (Module m : modules) if (m.id.equals(id) && m.isEnabled()) return true; return false; }
    public Module getModule(String id) { for (Module m : modules) if (m.id.equals(id)) return m; return null; }

    public void onTick(MinecraftClient mc) {
        for (Module m : modules) {
            try { m.checkKeybind(mc); } catch (Exception ignored) {}
            if (m.isEnabled()) { try { m.onTick(mc); } catch (Exception e) { System.err.println("[SnailMod] " + m.name + ": " + e.getMessage()); } }
        }
    }

    // ─── Config persistence ───
    private Path getConfigPath() {
        return MinecraftClient.getInstance().runDirectory.toPath().resolve("config").resolve("snailmod.json");
    }

    public void saveConfig() {
        try {
            Path p = getConfigPath();
            Files.createDirectories(p.getParent());
            StringBuilder sb = new StringBuilder("{\n");
            for (int i = 0; i < modules.size(); i++) {
                Module m = modules.get(i);
                sb.append("  \"").append(m.id).append("\": { \"key\": ").append(m.keybind)
                  .append(", \"enabled\": ").append(m.isEnabled()).append(" }");
                if (i < modules.size() - 1) sb.append(",");
                sb.append("\n");
            }
            sb.append("}");
            Files.writeString(p, sb.toString());
        } catch (Exception e) { System.err.println("[SnailMod] Config save failed: " + e.getMessage()); }
    }

    public void loadConfig() {
        try {
            Path p = getConfigPath();
            if (!Files.exists(p)) return;
            String json = Files.readString(p);
            // Simple JSON parsing without dependencies
            for (Module m : modules) {
                String key = "\"" + m.id + "\"";
                int idx = json.indexOf(key);
                if (idx < 0) continue;
                // Find keybind value
                int keyIdx = json.indexOf("\"key\":", idx);
                if (keyIdx > 0) {
                    int start = keyIdx + 6;
                    int end = json.indexOf(",", start);
                    if (end < 0) end = json.indexOf("}", start);
                    String val = json.substring(start, end).trim();
                    m.keybind = Integer.parseInt(val);
                }
                // Find enabled value
                int enIdx = json.indexOf("\"enabled\":", idx);
                if (enIdx > 0) {
                    int start = enIdx + 10;
                    int end = json.indexOf("}", start);
                    String val = json.substring(start, end).trim();
                    if (Boolean.parseBoolean(val) != m.isEnabled()) m.toggle();
                }
            }
            System.out.println("[SnailMod] Config loaded from " + p);
        } catch (Exception e) { System.err.println("[SnailMod] Config load failed: " + e.getMessage()); }
    }

    // ═══ AUTO CLICKER — Uses direct mouse check, works with any held item ═══
    public class AutoClicker extends Module {
        private int timer = 0, nextDelay = 2;
        public AutoClicker() { super("autoclicker", "Auto Clicker", "Randomized CPS (8-14) when holding left click", "Combat", 0xFFFF5555, true, GLFW.GLFW_KEY_R); }
        @Override public void onTick(MinecraftClient mc) {
            if (mc.player == null || mc.currentScreen != null || mc.interactionManager == null) return;
            // Check left mouse button directly via GLFW — avoids keybinding consumption issues
            long window = mc.getWindow().getHandle();
            boolean leftHeld = GLFW.glfwGetMouseButton(window, GLFW.GLFW_MOUSE_BUTTON_LEFT) == GLFW.GLFW_PRESS;
            if (leftHeld) {
                timer++;
                if (timer >= nextDelay) {
                    if (mc.targetedEntity != null) {
                        // Attack the entity we're looking at
                        mc.interactionManager.attackEntity(mc.player, mc.targetedEntity);
                    }
                    // Always swing hand — this triggers attack animation and block breaking
                    mc.player.swingHand(Hand.MAIN_HAND);
                    timer = 0;
                    nextDelay = 1 + rng.nextInt(3); // Randomized 7-20 CPS
                }
            } else { timer = 0; }
        }
    }

    // ═══ KILL AURA — Attacks players AND hostile mobs in FOV ═══
    public class KillAura extends Module {
        private int cd = 0;
        public KillAura() { super("killaura", "Kill Aura", "Auto-attacks players & mobs in FOV (4 blocks)", "Combat", 0xFFFF4444, true, GLFW.GLFW_KEY_V); }
        @Override public void onTick(MinecraftClient mc) {
            if (mc.player == null || mc.world == null || mc.currentScreen != null) return;
            cd++;
            if (cd < 10 + rng.nextInt(4)) return;
            ClientPlayerEntity p = mc.player;
            Box box = p.getBoundingBox().expand(4.0);
            LivingEntity best = null; double bestD = 5;
            Vec3d look = p.getRotationVec(1.0f);
            for (Entity e : mc.world.getOtherEntities(p, box)) {
                if (!(e instanceof LivingEntity living) || !living.isAlive()) continue;
                if (!(e instanceof PlayerEntity) && !(e instanceof HostileEntity)) continue;
                double d = p.distanceTo(e);
                Vec3d toE = e.getPos().subtract(p.getPos()).normalize();
                if (look.dotProduct(toE) < 0.3) continue;
                if (d < bestD) { best = living; bestD = d; }
            }
            if (best != null && mc.interactionManager != null) {
                mc.interactionManager.attackEntity(p, best);
                p.swingHand(Hand.MAIN_HAND);
                cd = 0;
            }
        }
    }

    // ═══ AUTO SPRINT ═══
    public static class AutoSprint extends Module {
        public AutoSprint() { super("sprint", "Auto Sprint", "Automatically sprint when moving forward", "Movement", 0xFF55FF55, false, GLFW.GLFW_KEY_X); }
        @Override public void onTick(MinecraftClient mc) {
            if (mc.player == null || mc.currentScreen != null) return;
            try {
                if (mc.player.forwardSpeed > 0 && !mc.player.isSneaking() && mc.player.getHungerManager().getFoodLevel() > 6)
                    mc.player.setSprinting(true);
            } catch (Exception ignored) {}
        }
    }

    // ═══ INFINITE JUMP ═══
    public static class InfiniteJump extends Module {
        private boolean wasJump = false;
        public InfiniteJump() { super("infinitejump", "Infinite Jump", "Jump multiple times in the air", "Movement", 0xFF55FFFF, true); }
        @Override public void onTick(MinecraftClient mc) {
            if (mc.player == null || mc.currentScreen != null) return;
            boolean jump = mc.options.jumpKey.isPressed();
            if (jump && !wasJump && !mc.player.isOnGround()) {
                mc.player.setVelocity(mc.player.getVelocity().x, 0.42, mc.player.getVelocity().z);
            }
            wasJump = jump;
        }
    }

    // ═══ AUTO CROUCH — Smart edge detection while holding crouch ═══
    public static class AutoCrouch extends Module {
        public AutoCrouch() { super("autocrouch", "Auto Crouch", "Smart crouch at edges while holding shift", "Movement", 0xFF7DC4E4, false, GLFW.GLFW_KEY_C); }
        @Override public void onTick(MinecraftClient mc) {
            if (mc.player == null || mc.world == null || mc.currentScreen != null) return;
            ClientPlayerEntity p = mc.player;
            if (!mc.options.sneakKey.isPressed()) return;
            BlockPos below = p.getBlockPos().down();
            boolean safeCenter = !mc.world.getBlockState(below).isAir();
            if (!safeCenter) return;
            double px = p.getX() - Math.floor(p.getX());
            double pz = p.getZ() - Math.floor(p.getZ());
            boolean nearEdge = false;
            double threshold = 0.3;
            if (px < threshold && mc.world.getBlockState(below.west()).isAir()) nearEdge = true;
            if (px > 1.0 - threshold && mc.world.getBlockState(below.east()).isAir()) nearEdge = true;
            if (pz < threshold && mc.world.getBlockState(below.north()).isAir()) nearEdge = true;
            if (pz > 1.0 - threshold && mc.world.getBlockState(below.south()).isAir()) nearEdge = true;
            if (nearEdge) p.setSneaking(true);
        }
    }

    // ═══ AUTO BRIDGE — Places blocks below you while moving ═══
    public static class AutoBridge extends Module {
        private int delay = 0;
        public AutoBridge() { super("autobridge", "Auto Bridge", "Places blocks below you while moving", "Movement", 0xFFF5C2E7, true, GLFW.GLFW_KEY_B); }
        @Override public void onTick(MinecraftClient mc) {
            if (mc.player == null || mc.world == null || mc.currentScreen != null) return;
            ClientPlayerEntity p = mc.player;
            if (mc.interactionManager == null) return;
            delay++;
            if (delay < 2) return;

            // Block position directly below the player's feet
            BlockPos belowFeet = new BlockPos(
                MathHelper.floor(p.getX()),
                MathHelper.floor(p.getY()) - 1,
                MathHelper.floor(p.getZ())
            );

            if (!mc.world.getBlockState(belowFeet).isAir()) return;

            // Find a block item in hotbar
            int blockSlot = -1;
            for (int i = 0; i < 9; i++) {
                if (p.getInventory().getStack(i).getItem() instanceof BlockItem) {
                    blockSlot = i; break;
                }
            }
            if (blockSlot < 0) return;

            // Temporarily switch to block slot
            int prevSlot = p.getInventory().selectedSlot;
            p.getInventory().selectedSlot = blockSlot;

            // Try to place against a neighboring solid block
            Direction[] dirs = {Direction.DOWN, Direction.NORTH, Direction.SOUTH, Direction.EAST, Direction.WEST, Direction.UP};
            boolean placed = false;
            for (Direction dir : dirs) {
                BlockPos neighbor = belowFeet.offset(dir);
                if (!mc.world.getBlockState(neighbor).isAir()) {
                    // Hit position: center of the face of the NEIGHBOR block facing toward belowFeet
                    Vec3d hitPos = Vec3d.ofCenter(neighbor).add(
                        dir.getOpposite().getOffsetX() * 0.5,
                        dir.getOpposite().getOffsetY() * 0.5,
                        dir.getOpposite().getOffsetZ() * 0.5
                    );
                    // We click on the neighbor block's face that faces belowFeet
                    BlockHitResult hit = new BlockHitResult(hitPos, dir.getOpposite(), neighbor, false);
                    mc.interactionManager.interactBlock(p, Hand.MAIN_HAND, hit);
                    p.swingHand(Hand.MAIN_HAND);
                    placed = true;
                    delay = 0;
                    break;
                }
            }

            // Restore slot after a short delay (next tick will restore)
            if (!placed) {
                p.getInventory().selectedSlot = prevSlot;
            }
        }
    }

    // ═══ FAST PLACE ═══
    public static class FastPlace extends Module {
        public FastPlace() { super("fastplace", "Fast Place", "No delay between block placements", "Player", 0xFFFFAA00, true); }
    }

    // ═══ FULLBRIGHT ═══
    public static class Fullbright extends Module {
        private double prev = 1.0;
        public Fullbright() { super("fullbright", "Fullbright", "Maximum brightness — see in the dark", "Player", 0xFFFFFF55, false, GLFW.GLFW_KEY_H); }
        @Override protected void onEnable() { try { var mc = MinecraftClient.getInstance(); prev = mc.options.getGamma().getValue(); setGamma(mc, 100.0); } catch (Exception ignored) {} }
        @Override protected void onDisable() { try { setGamma(MinecraftClient.getInstance(), prev); } catch (Exception ignored) {} }
        @Override public void onTick(MinecraftClient mc) { try { if (mc.options.getGamma().getValue() < 5.0) setGamma(mc, 100.0); } catch (Exception ignored) {} }
        private void setGamma(MinecraftClient mc, double val) {
            try { var f = mc.options.getGamma().getClass().getDeclaredField("value"); f.setAccessible(true); f.set(mc.options.getGamma(), val); }
            catch (Exception e) { mc.options.getGamma().setValue(val); }
        }
    }

    // ═══ VISUAL / HUD ═══
    public static class FPSDisplay extends Module {
        public FPSDisplay() { super("fps", "FPS Display", "Show FPS counter on screen", "Visual", 0xFF89B4FA, false); }
    }
    public static class CoordDisplay extends Module {
        public CoordDisplay() { super("coords", "Coordinates", "Show XYZ coordinates on screen", "Visual", 0xFF89DCEB, false); }
    }
    public static class ArmorHUD extends Module {
        public ArmorHUD() { super("armorhud", "Armor HUD", "Show armor durability on screen", "Visual", 0xFFF5C2E7, false); }
    }
    public static class PotionTimer extends Module {
        public PotionTimer() { super("potions", "Potion Timer", "Show active potion effects with timers", "Visual", 0xFFCBA6F7, false); }
    }
}
