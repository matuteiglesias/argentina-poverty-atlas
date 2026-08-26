from __future__ import annotations

import time

import scripts.publish_w3_mapbox as publisher

POLL_SECONDS = 5
MAX_POLLS = 360  # 30 minutes; bounded below the workflow timeout.


def create_and_wait_for_upload(staged_url: str) -> dict:
    created = publisher.request_json(
        "POST",
        f"/uploads/v1/{publisher.MAPBOX_USERNAME}",
        payload={
            "tileset": publisher.TILESET_ID,
            "url": staged_url,
            "name": publisher.TILESET_NAME,
        },
        label="Mapbox upload creation",
    )
    upload_id = created.get("id")
    if not isinstance(upload_id, str) or not upload_id:
        raise RuntimeError("Mapbox upload creation did not return an upload id")
    if created.get("tileset") != publisher.TILESET_ID:
        raise RuntimeError(
            f"Mapbox upload targeted unexpected tileset: {created.get('tileset')!r}"
        )

    print(
        "Mapbox upload created: "
        f"tileset={publisher.TILESET_ID}, upload_id={upload_id}, "
        f"initial_progress={created.get('progress')!r}"
    )

    last_progress: object = created.get("progress")
    for poll in range(MAX_POLLS):
        status = publisher.request_json(
            "GET",
            f"/uploads/v1/{publisher.MAPBOX_USERNAME}/{upload_id}",
            label="Mapbox upload status",
        )
        if status.get("error"):
            raise RuntimeError(f"Mapbox upload failed: {status['error']}")

        progress = status.get("progress")
        if progress != last_progress or poll % 12 == 0:
            print(
                "Mapbox upload status: "
                f"upload_id={upload_id}, progress={progress!r}, "
                f"complete={status.get('complete')!r}, modified={status.get('modified')!r}"
            )
            last_progress = progress

        if status.get("complete") is True:
            if status.get("progress") != 1:
                raise RuntimeError("Mapbox marked upload complete without progress=1")
            return status
        time.sleep(POLL_SECONDS)

    raise RuntimeError(
        "Mapbox upload did not complete within the 30-minute bounded polling window; "
        f"upload_id={upload_id}, last_progress={last_progress!r}"
    )


def main() -> None:
    publisher.create_and_wait_for_upload = create_and_wait_for_upload
    publisher.main()


if __name__ == "__main__":
    main()
