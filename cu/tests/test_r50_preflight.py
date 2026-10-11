"""R50-Awamu 0.5: PREFLIGHT — scaffold isighairike (kosa la SafariSmart: `npm create vite .`
ilipata workspace yenye CLAUDE.md/STATUS.md → ikakataliwa; Tailwind haikusakinishwa kamwe).

• pre_tool (Bash) ikiona SCAFFOLD_RX na workspace ina meta-files → zinaSTASHwa /tmp kabla.
• PostToolUse / PostToolUseFailure / Stop → zinarudishwa (backstop: plan.md LAZIMA iwe
  workspace kabla ya hooks za mpango kupima `plan_run`).
• Files zisizo meta (src/, index.html, package.json) haziguzwi KAMWE.

Msingi wa utafiti: Anthropic "Effective harnesses for long-running agents" (Nov 2025) — scaffold
ya mradi LAZIMA iweze kuendesha kwenye session yoyote; meta-files za harness zisiwe kizuizi.
"""
import os
import shutil
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import bridge
from bridge import (HookState, SCAFFOLD_RX, META_FILES, preflight_post_tool,
                    preflight_pre_tool, restore_meta_files, stash_meta_files)

SCAFFOLDS = (
    "npm create vite@latest . -- --template react",
    "npm create vite .",
    "npm init vite@latest",
    "npx create-vite@latest my-app",
    "npx --yes create-vite@latest .",
    "pnpm create vite",
    "yarn create next-app",
    "bun create vite",
    "git clone https://github.com/user/repo.git .",
    "degit user/repo .",
)
HAISTASHI = (
    "npm install",
    "npm run build",
    "npm test",
    "npx tsc --noEmit",
    "git add -A && git commit -m x",
    "mkdir -p src/components",
)


class Base(unittest.TestCase):
    def setUp(self):
        self.ws = tempfile.mkdtemp(prefix="xmd-ws-")
        self.stash = tempfile.mkdtemp(prefix="xmd-stash-")
        self._old = bridge.STASH_DIR
        bridge.STASH_DIR = self.stash
        self.st = HookState()

    def tearDown(self):
        bridge.STASH_DIR = self._old
        shutil.rmtree(self.ws, ignore_errors=True)
        shutil.rmtree(self.stash, ignore_errors=True)

    def meta_all(self):
        for name in META_FILES:
            with open(os.path.join(self.ws, name), "w", encoding="utf-8") as fh:
                fh.write(f"# {name}\n")
        os.makedirs(os.path.join(self.ws, ".xmd"), exist_ok=True)
        with open(os.path.join(self.ws, ".xmd", "state.json"), "w", encoding="utf-8") as fh:
            fh.write("{}")

    def normal_files(self):
        os.makedirs(os.path.join(self.ws, "src"), exist_ok=True)
        with open(os.path.join(self.ws, "src", "main.jsx"), "w", encoding="utf-8") as fh:
            fh.write("x")
        with open(os.path.join(self.ws, "index.html"), "w", encoding="utf-8") as fh:
            fh.write("x")

    def exists(self, rel):
        return os.path.exists(os.path.join(self.ws, rel))


class TestStashRestore(Base):
    def test_scaffold_inastash_na_restore(self):
        self.meta_all()
        self.normal_files()
        r = preflight_pre_tool(self.st, self.ws, "Bash",
                               {"command": "npm create vite@latest . -- --template react"})
        self.assertEqual(r["stashed"], len(META_FILES) + 1)   # meta files + .xmd/
        for name in META_FILES:
            self.assertFalse(self.exists(name), f"{name} LAZIMA iwe imestashwa")
        self.assertFalse(self.exists(".xmd"))
        # files za kawaida haziguzwi
        self.assertTrue(self.exists("src/main.jsx"))
        self.assertTrue(self.exists("index.html"))
        # zipo kwenye stash
        self.assertTrue(os.path.exists(os.path.join(self.stash, "CLAUDE.md")))

    def test_post_tool_inarudisha_kila_kitu(self):
        self.meta_all()
        preflight_pre_tool(self.st, self.ws, "Bash", {"command": "npm create vite ."})
        out = preflight_post_tool(self.st, None)
        self.assertEqual(out["restored"], len(META_FILES) + 1)
        for name in META_FILES:
            self.assertTrue(self.exists(name), f"{name} LAZIMA irudi")
        self.assertTrue(self.exists(".xmd/state.json"))
        self.assertEqual(self.st.meta_stash, [])

    def test_stash_bila_meta_hakuna_kitu(self):
        self.normal_files()
        r = preflight_pre_tool(self.st, self.ws, "Bash", {"command": "npm create vite ."})
        self.assertEqual(r, {})
        self.assertEqual(self.st.meta_stash, [])
        self.assertTrue(self.exists("index.html"))

    def test_pre_tool_ya_pili_haistashi_tena(self):
        self.meta_all()
        preflight_pre_tool(self.st, self.ws, "Bash", {"command": "npm create vite ."})
        self.assertEqual(len(self.st.meta_stash), len(META_FILES) + 1)
        r2 = preflight_pre_tool(self.st, self.ws, "Bash", {"command": "npm create vite ."})
        self.assertEqual(r2, {})   # guard: stash inaendelea tayari
        self.assertEqual(len(self.st.meta_stash), len(META_FILES) + 1)

    def test_post_tool_bila_stash_salama(self):
        self.assertEqual(preflight_post_tool(self.st, None), {})

    def test_restore_idempotent(self):
        self.meta_all()
        preflight_pre_tool(self.st, self.ws, "Bash", {"command": "git clone https://x/y ."})
        preflight_post_tool(self.st, None)
        self.assertEqual(preflight_post_tool(self.st, None), {})   # mara ya pili: hakuna kitu


class TestCollision(Base):
    def test_scaffold_ikileta_faili_la_jina_lile_scaffold_inashinda(self):
        """git clone yenye CLAUDE.md yake: toleo la project linabaki; letu linarudi kwa mengine."""
        self.meta_all()
        preflight_pre_tool(self.st, self.ws, "Bash", {"command": "git clone https://x/y ."})
        # scaffold imeunda CLAUDE.md mpya kwenye workspace
        with open(os.path.join(self.ws, "CLAUDE.md"), "w", encoding="utf-8") as fh:
            fh.write("# ya project\n")
        out = preflight_post_tool(self.st, None)
        self.assertEqual(out["restored"], len(META_FILES))     # zote kasoro CLAUDE.md (1)
        with open(os.path.join(self.ws, "CLAUDE.md"), "r", encoding="utf-8") as fh:
            self.assertEqual(fh.read(), "# ya project\n")      # haikugongwa
        self.assertTrue(self.exists("STATUS.md"))              # zilizobaki zimerudi


class TestRegex(Base):
    def test_scaffold_rx_inakamata(self):
        for cmd in SCAFFOLDS:
            self.assertTrue(SCAFFOLD_RX.search(cmd), f"LAZIMA ikamate: {cmd}")

    def test_scaffold_rx_haili_commands_nyingine(self):
        for cmd in HAISTASHI:
            self.assertFalse(SCAFFOLD_RX.search(cmd), f"HAIPASI ikamate: {cmd}")

    def test_helpers_pekee(self):
        self.meta_all()
        moved = stash_meta_files(self.ws)
        self.assertEqual(len(moved), len(META_FILES) + 1)
        self.assertEqual(restore_meta_files(moved), len(META_FILES) + 1)
        self.assertTrue(self.exists("plan.md"))


if __name__ == "__main__":
    unittest.main()
