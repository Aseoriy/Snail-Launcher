package dev.snail.module;

import net.minecraft.client.MinecraftClient;
import org.lwjgl.glfw.GLFW;

public abstract class Module {
    public final String id, name, description, category;
    public final int color;
    public final boolean risky;
    private boolean enabled = false;
    public int keybind = -1; // GLFW key code, -1 = none
    private boolean wasKeyDown = false;

    public Module(String id, String name, String desc, String cat, int color, boolean risky) {
        this.id = id; this.name = name; this.description = desc;
        this.category = cat; this.color = color; this.risky = risky;
    }

    public Module(String id, String name, String desc, String cat, int color, boolean risky, int defaultKey) {
        this(id, name, desc, cat, color, risky);
        this.keybind = defaultKey;
    }

    public boolean isEnabled() { return enabled; }
    public void toggle() { enabled = !enabled; if (enabled) onEnable(); else onDisable(); }
    public void setEnabled(boolean s) { if (s != enabled) toggle(); }

    /** Check keybind toggle — called every tick */
    public void checkKeybind(MinecraftClient mc) {
        if (keybind < 0 || mc.currentScreen != null) return;
        long win = mc.getWindow().getHandle();
        boolean down = org.lwjgl.glfw.GLFW.glfwGetKey(win, keybind) == GLFW.GLFW_PRESS;
        if (down && !wasKeyDown) toggle();
        wasKeyDown = down;
    }

    public String getKeyName() {
        if (keybind < 0) return "None";
        String name = GLFW.glfwGetKeyName(keybind, 0);
        return name != null ? name.toUpperCase() : "KEY" + keybind;
    }

    protected void onEnable() {}
    protected void onDisable() {}
    public void onTick(MinecraftClient mc) {}
}
