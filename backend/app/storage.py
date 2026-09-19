import json
import logging
import os
from pathlib import Path
from typing import Dict, List, Optional
from app.models import EmergencyMessage

logger = logging.getLogger("morrowmesh.storage")

DATA_DIR = Path(__file__).resolve().parent / "data"
STORE_FILE = DATA_DIR / "messages_store.json"


class MessageStore:
    """Lightweight in-memory store with JSON file persistence.

    Gracefully handles missing, empty, or malformed persistence files on startup.
    """

    def __init__(self, storage_path: Path = STORE_FILE):
        self.storage_path = storage_path
        self._messages: Dict[str, EmergencyMessage] = {}
        self._ensure_storage_dir()
        self._load()

    def _ensure_storage_dir(self) -> None:
        try:
            self.storage_path.parent.mkdir(parents=True, exist_ok=True)
        except Exception as e:
            logger.warning(f"Could not create storage directory {self.storage_path.parent}: {e}")

    def _load(self) -> None:
        if not self.storage_path.exists():
            logger.info("Store file does not exist. Starting with empty store.")
            self._messages = {}
            return

        try:
            content = self.storage_path.read_text(encoding="utf-8").strip()
            if not content:
                logger.info("Store file is empty. Starting with empty store.")
                self._messages = {}
                return

            data = json.loads(content)
            if not isinstance(data, dict):
                logger.warning("Store file root is not an object. Starting with empty store.")
                self._messages = {}
                return

            loaded: Dict[str, EmergencyMessage] = {}
            for msg_id, raw_msg in data.items():
                try:
                    loaded[msg_id] = EmergencyMessage.model_validate(raw_msg)
                except Exception as val_err:
                    logger.warning(f"Skipping malformed message {msg_id}: {val_err}")

            self._messages = loaded
            logger.info(f"Loaded {len(self._messages)} messages from persistence store.")
        except json.JSONDecodeError as jde:
            logger.error(f"Malformed JSON in store file ({jde}). Initializing empty in-memory store.")
            self._messages = {}
        except Exception as err:
            logger.error(f"Unexpected error loading store file ({err}). Initializing empty store.")
            self._messages = {}

    def _persist(self) -> None:
        try:
            self._ensure_storage_dir()
            data = {msg_id: msg.model_dump() for msg_id, msg in self._messages.items()}
            # Write safely using temporary replacement
            temp_file = self.storage_path.with_suffix(".tmp")
            temp_file.write_text(json.dumps(data, indent=2), encoding="utf-8")
            temp_file.replace(self.storage_path)
        except Exception as e:
            logger.error(f"Failed to persist messages to {self.storage_path}: {e}")

    def get_all(self) -> List[EmergencyMessage]:
        return list(self._messages.values())

    def get(self, message_id: str) -> Optional[EmergencyMessage]:
        return self._messages.get(message_id)

    def add_or_update(self, message: EmergencyMessage) -> None:
        self._messages[message.id] = message
        self._persist()

    def add_batch(self, messages: List[EmergencyMessage]) -> None:
        for m in messages:
            self._messages[m.id] = m
        self._persist()

    def update_status(self, message_id: str, new_status: str) -> Optional[EmergencyMessage]:
        msg = self._messages.get(message_id)
        if not msg:
            return None
        # Copy and update status
        updated = msg.model_copy(update={"status": new_status})
        self._messages[message_id] = updated
        self._persist()
        return updated

    def clear(self) -> None:
        self._messages = {}
        self._persist()


# Global singleton store
store = MessageStore()
