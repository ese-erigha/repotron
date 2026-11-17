import io
import logging
import tarfile
from pathlib import Path

import httpx

logger = logging.getLogger(__name__)


class TarballError(Exception):
    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


def fetch_tarball(owner: str, name: str, commit_sha: str, token: str, destination: Path) -> None:
    url = f"https://api.github.com/repos/{owner}/{name}/tarball/{commit_sha}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "User-Agent": "repotron",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    with httpx.stream("GET", url, headers=headers, follow_redirects=True, timeout=120) as response:
        if response.status_code == 404:
            logger.error(
                "tarball_failed status=%s owner=%s name=%s", response.status_code, owner, name
            )
            raise TarballError("The repository download was not found.")
        if response.status_code >= 400:
            logger.error(
                "tarball_failed status=%s owner=%s name=%s", response.status_code, owner, name
            )
            raise TarballError("The repository download failed.")
        payload = b"".join(response.iter_bytes())
    extract_tarball(payload, destination)


def extract_tarball(payload: bytes, destination: Path) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    root = destination.resolve()
    with tarfile.open(fileobj=io.BytesIO(payload), mode="r:*") as archive:
        for member in archive.getmembers():
            _extract_member(archive, member, root)


def _extract_member(archive: tarfile.TarFile, member: tarfile.TarInfo, root: Path) -> None:
    if member.issym() or member.islnk():
        return
    target = (root / member.name).resolve()
    if not target.is_relative_to(root):
        logger.error("tarball_failed unsafe_path=%s", member.name)
        raise TarballError("The repository archive contains an unsafe path.")
    if member.isdir():
        target.mkdir(parents=True, exist_ok=True)
        return
    if not member.isfile():
        return
    source = archive.extractfile(member)
    if source is None:
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(source.read())
