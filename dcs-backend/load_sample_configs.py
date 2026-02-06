#!/usr/bin/env python3
"""
Load sample configurations from JSON files into the database.
Run this script to import/update configurations from the sample_configs/ directory.
"""

import os
import sys
import json
from datetime import datetime

# Add parent directory to path so we can import from the backend
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal
from models import Configuration

def load_sample_configs():
    """Load all JSON files from sample_configs/ into the database."""
    
    sample_configs_dir = "./sample_configs"
    
    if not os.path.exists(sample_configs_dir):
        print(f"❌ Directory not found: {sample_configs_dir}")
        return
    
    # Get all JSON files
    json_files = [f for f in os.listdir(sample_configs_dir) if f.endswith('.json')]
    
    if not json_files:
        print(f"❌ No JSON files found in {sample_configs_dir}")
        return
    
    print("=" * 60)
    print(f"📂 Loading sample configurations from {sample_configs_dir}")
    print("=" * 60)
    
    db = SessionLocal()
    
    try:
        for json_file in json_files:
            file_path = os.path.join(sample_configs_dir, json_file)
            
            print(f"\n📄 Processing: {json_file}")
            
            try:
                # Read JSON file
                with open(file_path, 'r') as f:
                    config_data = json.load(f)
                
                name = config_data.get('name')
                description = config_data.get('description', '')
                data = config_data.get('data', {})
                
                if not name:
                    print(f"   ⚠️  Skipping {json_file}: No 'name' field found")
                    continue
                
                # Check if configuration already exists
                existing = db.query(Configuration).filter(Configuration.name == name).first()
                
                if existing:
                    # Update existing configuration
                    print(f"   🔄 Updating existing configuration: '{name}'")
                    existing.description = description
                    existing.data = json.dumps(data)
                    existing.updated_at = datetime.utcnow()
                    print(f"   ✅ Updated successfully")
                else:
                    # Create new configuration
                    print(f"   ➕ Creating new configuration: '{name}'")
                    new_config = Configuration(
                        name=name,
                        description=description,
                        data=json.dumps(data)
                    )
                    db.add(new_config)
                    print(f"   ✅ Created successfully")
                
            except json.JSONDecodeError as e:
                print(f"   ❌ Invalid JSON in {json_file}: {e}")
            except Exception as e:
                print(f"   ❌ Error processing {json_file}: {e}")
        
        # Commit all changes
        db.commit()
        print("\n" + "=" * 60)
        print(f"✅ Successfully loaded {len(json_files)} configurations into database")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ Database error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    load_sample_configs()
