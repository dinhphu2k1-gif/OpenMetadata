"""Chồng DqrColumnSqlValidator lên package openmetadata-ingestion đã cài trong image Airflow.

Chạy trong lúc build image (Dockerfile.ingestion). Mỗi bước kiểm tra chuỗi neo và dừng với lỗi rõ ràng nếu
bản ingestion gốc khác với giả định, để image không build ra mà thiếu validator.
"""
import importlib.util
import pathlib
import shutil
import sys

SOURCE = pathlib.Path("/tmp/dqrColumnSqlValidator.py")


def package_dir() -> pathlib.Path:
    spec = importlib.util.find_spec("metadata")
    if spec is None or not spec.submodule_search_locations:
        sys.exit("Không tìm thấy package 'metadata' của openmetadata-ingestion")
    return pathlib.Path(list(spec.submodule_search_locations)[0])


def patch(path: pathlib.Path, anchor: str, addition: str, marker: str) -> None:
    text = path.read_text(encoding="utf-8")
    if marker in text:
        return
    if text.count(anchor) != 1:
        sys.exit(f"Không tìm thấy đúng một chuỗi neo trong {path}: {anchor!r}")
    path.write_text(text.replace(anchor, anchor + addition), encoding="utf-8")


def main() -> None:
    root = package_dir()
    target = root / "data_quality/validations/column/sqlalchemy/dqrColumnSqlValidator.py"
    shutil.copy(SOURCE, target)

    patch(
        root / "utils/importer.py",
        '    "ColumnRuleLibrarySqlExpressionValidator": "columnRuleLibrarySqlExpressionValidator",\n',
        '    "DqrColumnSqlValidator": "dqrColumnSqlValidator",\n',
        '"DqrColumnSqlValidator"',
    )
    patch(
        root / "data_quality/validations/runtime_param_setter/param_setter_factory.py",
        "            TableRuleLibrarySqlExpressionValidator.__name__: {\n"
        "                RuleLibrarySqlExpressionParamsSetter\n"
        "            },\n",
        '            "DqrColumnSqlValidator": {RuleLibrarySqlExpressionParamsSetter},\n',
        '"DqrColumnSqlValidator"',
    )
    print(f"DqrColumnSqlValidator đã được cài vào {root}")


main()
