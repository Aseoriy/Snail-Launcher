package dev.snail.gui;

import dev.snail.module.Module;
import dev.snail.module.ModuleManager;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.text.Text;
import java.util.*;
import java.util.stream.Collectors;

public class SnailScreen extends Screen {
    // Catppuccin Mocha
    static final int BG=0xDD11111B, PANEL=0xFF1E1E2E, SIDEBAR=0xFF181825;
    static final int CARD=0xFF313244, CARD_H=0xFF45475A, BORDER=0xFF45475A;
    static final int TXT=0xFFCDD6F4, TXT_D=0xFF9399B2, TXT_M=0xFF585B70;
    static final int GREEN=0xFFA6E3A1, BLUE=0xFF89B4FA, TOG_OFF=0xFF45475A;
    static final int RED=0xFFf38BA8, WARN=0xFFFAB387, YELLOW=0xFFF9E2AF;

    static final String[] TABS = {"All","Combat","Movement","Player","Visual"};
    int selTab = 0;
    float scroll = 0, targetScroll = 0;
    int panelX, panelY, panelW, panelH, sideW=90, contentX, contentW, contentY, contentH;

    // Keybind editing state
    Module bindingModule = null; // non-null = waiting for key press

    public SnailScreen() { super(Text.literal("Snail Menu")); }
    @Override public boolean shouldPause() { return false; }

    List<Module> filtered() {
        List<Module> all = ModuleManager.INSTANCE.getModules();
        if (selTab == 0) return all;
        String cat = TABS[selTab];
        return all.stream().filter(m -> m.category.equals(cat)).collect(Collectors.toList());
    }

    @Override
    public void render(DrawContext ctx, int mx, int my, float delta) {
        scroll += (targetScroll - scroll) * 0.3f;

        panelW = Math.min(520, width - 40);
        panelH = Math.min(380, height - 40);
        panelX = (width - panelW) / 2;
        panelY = (height - panelH) / 2;
        contentX = panelX + sideW;
        contentW = panelW - sideW;
        contentY = panelY + 32;
        contentH = panelH - 32;

        ctx.fill(0, 0, width, height, BG);
        ctx.fill(panelX, panelY, panelX+panelW, panelY+panelH, PANEL);
        // Borders
        ctx.fill(panelX, panelY, panelX+panelW, panelY+1, BORDER);
        ctx.fill(panelX, panelY+panelH-1, panelX+panelW, panelY+panelH, BORDER);
        ctx.fill(panelX, panelY, panelX+1, panelY+panelH, BORDER);
        ctx.fill(panelX+panelW-1, panelY, panelX+panelW, panelY+panelH, BORDER);

        // Title bar
        ctx.fill(panelX, panelY, panelX+panelW, panelY+28, SIDEBAR);
        ctx.drawText(textRenderer, "  \u2603 Snail Menu", panelX+4, panelY+10, GREEN, true);
        int mCount = (int) ModuleManager.INSTANCE.getModules().stream().filter(Module::isEnabled).count();
        ctx.drawText(textRenderer, mCount + " active", panelX+panelW-50, panelY+10, TXT_D, false);

        // Binding mode indicator
        if (bindingModule != null) {
            String hint = "Press a key for: " + bindingModule.name + "  (ESC = cancel, DEL = unbind)";
            int hw = textRenderer.getWidth(hint);
            ctx.fill(panelX, panelY+panelH, panelX+panelW, panelY+panelH+16, 0xFF313244);
            ctx.drawText(textRenderer, hint, panelX + (panelW-hw)/2, panelY+panelH+4, YELLOW, true);
        }

        // Sidebar
        ctx.fill(panelX, panelY+28, panelX+sideW, panelY+panelH, SIDEBAR);
        ctx.fill(panelX+sideW, panelY+28, panelX+sideW+1, panelY+panelH, BORDER);

        for (int i = 0; i < TABS.length; i++) {
            int ty = panelY + 34 + i * 26;
            boolean hover = mx >= panelX && mx < panelX+sideW && my >= ty && my < ty+24;
            boolean active = i == selTab;
            if (active) {
                ctx.fill(panelX+2, ty, panelX+sideW-1, ty+24, 0x20A6E3A1);
                ctx.fill(panelX, ty, panelX+3, ty+24, GREEN);
            } else if (hover) {
                ctx.fill(panelX+2, ty, panelX+sideW-1, ty+24, 0x10FFFFFF);
            }
            final int idx = i;
            long cnt = idx == 0 ? ModuleManager.INSTANCE.getModules().size() :
                ModuleManager.INSTANCE.getModules().stream().filter(m -> m.category.equals(TABS[idx])).count();
            ctx.drawText(textRenderer, TABS[idx], panelX+12, ty+8, active ? GREEN : (hover ? TXT : TXT_D), false);
            ctx.drawText(textRenderer, String.valueOf(cnt), panelX+sideW-16, ty+8, TXT_M, false);
        }

        // Content
        ctx.enableScissor(contentX, contentY, contentX+contentW, panelY+panelH-4);

        List<Module> mods = filtered();
        int cardH = 44, gap = 4, pad = 8;
        int totalH = mods.size() * (cardH + gap);
        float maxScroll = Math.max(0, totalH - contentH);
        if (targetScroll > maxScroll) targetScroll = maxScroll;
        if (targetScroll < 0) targetScroll = 0;

        for (int i = 0; i < mods.size(); i++) {
            Module m = mods.get(i);
            int cy = (int)(contentY + pad + i * (cardH + gap) - scroll);
            if (cy + cardH < contentY || cy > panelY + panelH) continue;

            int cx = contentX + pad;
            int cw = contentW - pad * 2;
            boolean hover = mx >= cx && mx < cx+cw && my >= cy && my < cy+cardH;
            ctx.fill(cx, cy, cx+cw, cy+cardH, hover ? CARD_H : CARD);
            ctx.fill(cx, cy, cx+3, cy+cardH, m.isEnabled() ? m.color : TOG_OFF);

            // Name + category tag
            ctx.drawText(textRenderer, m.name, cx+10, cy+6, TXT, true);
            String tag = m.category;
            int tagW = textRenderer.getWidth(tag) + 8;
            int tagX = cx + 10 + textRenderer.getWidth(m.name) + 6;
            ctx.fill(tagX, cy+4, tagX+tagW, cy+15, 0x30FFFFFF);
            ctx.drawText(textRenderer, tag, tagX+4, cy+6, TXT_M, false);
            if (m.risky) ctx.drawText(textRenderer, "\u26A0", tagX+tagW+4, cy+6, WARN, false);

            // Description
            String desc = m.description;
            if (textRenderer.getWidth(desc) > cw - 50) desc = desc.substring(0, Math.min(desc.length(), 35)) + "..";
            ctx.drawText(textRenderer, desc, cx+10, cy+20, TXT_D, false);

            // Status
            ctx.drawText(textRenderer, m.isEnabled() ? "ON" : "OFF", cx+10, cy+32, m.isEnabled() ? GREEN : TXT_M, false);

            // Keybind badge (clickable)
            boolean isBinding = bindingModule == m;
            String keyStr = isBinding ? "[...]" : "[" + m.getKeyName() + "]";
            int keyW = textRenderer.getWidth(keyStr);
            int kbX = cx+35, kbY = cy+30, kbX2 = cx+42+keyW, kbY2 = cy+42;
            boolean keyHover = mx >= kbX && mx < kbX2 && my >= kbY && my < kbY2;
            ctx.fill(kbX, kbY, kbX2, kbY2, isBinding ? 0x40F9E2AF : (keyHover ? 0x4089B4FA : 0x20FFFFFF));
            ctx.drawText(textRenderer, keyStr, cx+38, cy+32, isBinding ? YELLOW : (keyHover ? 0xFFB4D0FA : BLUE), false);

            // Toggle switch
            int tw=28, th=14, tx=cx+cw-tw-6, tyy=cy+(cardH-th)/2;
            int togBg = m.isEnabled() ? GREEN : TOG_OFF;
            ctx.fill(tx, tyy, tx+tw, tyy+th, togBg);
            ctx.fill(tx-1, tyy+1, tx, tyy+th-1, togBg);
            ctx.fill(tx+tw, tyy+1, tx+tw+1, tyy+th-1, togBg);
            int knobX = m.isEnabled() ? tx+tw-12 : tx+2;
            ctx.fill(knobX, tyy+2, knobX+10, tyy+th-2, 0xFFFFFFFF);
        }

        ctx.disableScissor();

        // Scrollbar
        if (totalH > contentH && maxScroll > 0) {
            int sbH = Math.max(20, (int)(contentH * contentH / totalH));
            int sbY = contentY + (int)((contentH - sbH) * (scroll / maxScroll));
            ctx.fill(contentX+contentW-4, contentY, contentX+contentW-1, panelY+panelH-4, 0x20FFFFFF);
            ctx.fill(contentX+contentW-4, sbY, contentX+contentW-1, sbY+sbH, 0x60FFFFFF);
        }
    }

    @Override
    public boolean mouseClicked(double mx, double my, int btn) {
        if (btn != 0) return super.mouseClicked(mx, my, btn);

        // Tab clicks
        for (int i = 0; i < TABS.length; i++) {
            int ty = panelY + 34 + i * 26;
            if (mx >= panelX && mx < panelX+sideW && my >= ty && my < ty+24) {
                selTab = i; targetScroll = 0; scroll = 0; bindingModule = null; return true;
            }
        }

        // Module card clicks
        List<Module> mods = filtered();
        int pad = 8;
        for (int i = 0; i < mods.size(); i++) {
            Module m = mods.get(i);
            int cy = (int)(contentY + pad + i * 48 - scroll);
            int cx = contentX + pad, cw = contentW - pad*2;
            if (mx < cx || mx >= cx+cw || my < cy || my >= cy+44) continue;

            // Check if click is on the keybind badge area
            String keyStr = bindingModule == m ? "[...]" : "[" + m.getKeyName() + "]";
            int keyW = textRenderer.getWidth(keyStr);
            int kbX = cx+35, kbY = cy+30, kbX2 = cx+42+keyW, kbY2 = cy+42;
            if (mx >= kbX && mx < kbX2 && my >= kbY && my < kbY2) {
                // Start keybind editing for this module
                bindingModule = (bindingModule == m) ? null : m;
                return true;
            }

            // Otherwise toggle the module
            m.toggle();
            ModuleManager.INSTANCE.saveConfig();
            return true;
        }
        return super.mouseClicked(mx, my, btn);
    }

    public boolean mouseScrolled(double mx, double my, double amount) {
        targetScroll -= (float)(amount * 30);
        return true;
    }

    @Override
    public boolean keyPressed(int key, int scan, int mods) {
        // If we're in keybind editing mode, capture the key
        if (bindingModule != null) {
            if (key == 256) { // ESC — cancel
                bindingModule = null;
            } else if (key == 261) { // DELETE — unbind
                bindingModule.keybind = -1;
                ModuleManager.INSTANCE.saveConfig();
                bindingModule = null;
            } else if (key != 344) { // Don't bind Right Shift (menu key)
                bindingModule.keybind = key;
                ModuleManager.INSTANCE.saveConfig();
                bindingModule = null;
            }
            return true;
        }

        if (key == 344 || key == 256) { close(); return true; }
        return super.keyPressed(key, scan, mods);
    }
}
