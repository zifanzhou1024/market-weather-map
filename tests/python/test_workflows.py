from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
UPDATE_DATA_WORKFLOW = ROOT / ".github" / "workflows" / "update-data.yml"


def workflow_text() -> str:
    return UPDATE_DATA_WORKFLOW.read_text(encoding="utf-8")


def test_update_data_workflow_deploys_pages_after_data_update() -> None:
    text = workflow_text()

    assert "contents: write" in text
    assert "pages: write" in text
    assert "id-token: write" in text
    assert "actions/setup-node@v4" in text
    assert "node-version: \"22\"" in text
    assert "cache: npm" in text
    assert "npm ci" in text
    assert "GITHUB_PAGES=true npm run build" in text
    assert "actions/upload-pages-artifact@v3" in text
    assert "path: dist" in text
    assert "actions/deploy-pages@v4" in text
