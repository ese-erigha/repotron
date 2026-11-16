import io
import json
import tarfile
from pathlib import Path

import jsonschema
import pytest

from indexer.chunk_code import chunk_code
from indexer.chunk_text import chunk_text
from indexer.fetch_tarball import TarballError, extract_tarball
from indexer.walk_files import walk_files
from indexer.write_batches import number_chunks

CONTRACT = json.loads(
    Path(__file__).parents[1].joinpath("src/indexer/contract.json").read_text(encoding="utf-8")
)


def _validate(chunks: list[dict[str, object]]) -> None:
    for chunk in number_chunks(chunks, "9-abc"):
        jsonschema.validate(chunk, CONTRACT["chunk"])


def test_when_a_python_file_has_two_functions_then_each_function_keeps_its_line_range() -> None:
    source = "def one():\n    return 1\n\ndef two():\n    return 2\n"
    chunks = [
        chunk for chunk in chunk_code("app.py", source, "python") if chunk["kind"] == "function"
    ]
    assert [(chunk["symbol"], chunk["startLine"], chunk["endLine"]) for chunk in chunks] == [
        ("one", 1, 2),
        ("two", 4, 5),
    ]
    _validate(chunks)


def test_when_a_module_region_exceeds_the_token_limit_then_it_splits_into_parts() -> None:
    source = ("word " * 20 + "\n") * 200
    chunks = chunk_code("notes.py", source, "python")
    assert len(chunks) == 3
    assert [chunk["kind"] for chunk in chunks] == ["module", "module", "module"]
    assert "".join(str(chunk["content"]) for chunk in chunks) == source.strip("\n")
    _validate(chunks)


def test_when_a_class_is_large_then_it_splits_at_its_methods_and_keeps_its_header() -> None:
    methods = "\n".join(
        f"    def method_{number}(self):\n        return {number}\n" for number in range(200)
    )
    chunks = chunk_code("app.py", f"class Big:\n{methods}", "python")
    method_chunks = [chunk for chunk in chunks if chunk["kind"] == "method"]
    assert len(method_chunks) == 200
    assert all("class Big" in str(chunk["header"]) for chunk in method_chunks)
    assert not any(chunk["kind"] == "class" for chunk in chunks)
    _validate(method_chunks)


def test_when_a_markdown_section_exceeds_the_token_limit_then_it_splits_into_parts() -> None:
    source = "# Start\n\n" + ("word " * 20 + "\n") * 200
    chunks = chunk_text("README.md", source, "markdown")
    assert len(chunks) == 3
    assert [chunk["symbol"] for chunk in chunks] == ["Start", "Start", "Start"]
    assert "".join(str(chunk["content"]) for chunk in chunks) == "\n".join(source.splitlines())
    _validate(chunks)


def test_when_markdown_has_headings_then_it_splits_at_each_heading() -> None:
    source = "# Start\n\nIntro\n\n## Next\n\nBody\n"
    chunks = chunk_text("README.md", source, "markdown")
    assert [chunk["symbol"] for chunk in chunks] == ["Start", "Next"]
    _validate(chunks)


def test_when_a_file_matches_a_skip_rule_then_the_walk_omits_it(
    tmp_path: Path,
) -> None:
    (tmp_path / "node_modules").mkdir()
    (tmp_path / "node_modules" / "lib.js").write_text("export const a = 1\n", encoding="utf-8")
    (tmp_path / "app.min.js").write_text("var a=1\n", encoding="utf-8")
    (tmp_path / "package-lock.json").write_text("{}\n", encoding="utf-8")
    (tmp_path / "binary.py").write_bytes(b"def a():\n    return 1\n\x00")
    (tmp_path / "huge.py").write_text(
        "a" * (CONTRACT["limits"]["fileMaxBytes"] + 1), encoding="utf-8"
    )
    (tmp_path / "kept.py").write_text("def kept():\n    return 1\n", encoding="utf-8")
    paths = [path for path, _text, _language in walk_files(tmp_path)]
    assert paths == ["kept.py"]


def test_when_a_tar_member_leaves_the_folder_then_extraction_fails(tmp_path: Path) -> None:
    payload = io.BytesIO()
    with tarfile.open(fileobj=payload, mode="w") as archive:
        info = tarfile.TarInfo("../outside.txt")
        data = b"nope"
        info.size = len(data)
        archive.addfile(info, io.BytesIO(data))
    with pytest.raises(TarballError):
        extract_tarball(payload.getvalue(), tmp_path)
