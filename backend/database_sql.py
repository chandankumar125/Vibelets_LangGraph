import sqlite3
import json
import uuid
from typing import Dict, List, Optional, Any
from datetime import datetime
import os

DB_FILE = "threads.db"

class DatabaseSQL:
    def __init__(self, db_file: str = DB_FILE):
        self.db_file = db_file
        self.init_db()

    def get_connection(self):
        conn = sqlite3.connect(self.db_file, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def init_db(self):
        """Initialize the database schema"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # Threads table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS threads (
            id TEXT PRIMARY KEY,
            title TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            state JSON
        )
        ''')
        
        conn.commit()
        conn.close()

    def get_thread(self, thread_id: str) -> Optional[Dict[str, Any]]:
        """Get a thread by ID"""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM threads WHERE id = ?', (thread_id,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return {
                "id": row["id"],
                "title": row["title"],
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
                "state": json.loads(row["state"]) if row["state"] else None
            }
        return None

    def get_all_threads(self) -> List[Dict[str, Any]]:
        """Get all threads ordered by updated_at desc"""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT id, title, created_at, updated_at FROM threads ORDER BY updated_at DESC')
        rows = cursor.fetchall()
        conn.close()
        
        return [dict(row) for row in rows]

    def save_thread(self, thread_id: str, state: Dict[str, Any], title: Optional[str] = None):
        """Save or update a thread"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # Check if exists to preserve title if not provided
        cursor.execute('SELECT title FROM threads WHERE id = ?', (thread_id,))
        existing = cursor.fetchone()
        
        current_title = title
        if not current_title:
            if existing:
                current_title = existing["title"]
            else:
                current_title = "New Conversation"
        
        state_json = json.dumps(state)
        now = datetime.now().isoformat()
        
        cursor.execute('''
        INSERT INTO threads (id, title, state, updated_at) 
        VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            state = excluded.state,
            title = CASE WHEN ? IS NOT NULL THEN ? ELSE threads.title END,
            updated_at = excluded.updated_at
        ''', (thread_id, current_title, state_json, now, title, title))
        
        conn.commit()
        conn.close()

    def delete_thread(self, thread_id: str):
        """Delete a thread"""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM threads WHERE id = ?', (thread_id,))
        conn.commit()
        conn.close()
    
    def update_thread_title(self, thread_id: str, title: str):
        """Update just the title"""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('UPDATE threads SET title = ? WHERE id = ?', (title, thread_id))
        conn.commit()
        conn.close()

# Global instance
db = DatabaseSQL()
