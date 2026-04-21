"""add user_type to users

Revision ID: a1b2c3d4e5f6
Revises: f1a2b3c4d5e6
Create Date: 2026-04-21 09:00:00.000000

Adds the user_type enum column to the users table to support
plan-based prompt limits (free / premium / admin).
Default is 'free' for all existing and new users.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Define the enum outside the functions so both upgrade/downgrade can reference it.
user_type_enum = sa.Enum('free', 'premium', 'admin', name='user_type_enum')


def upgrade() -> None:
    # 1. Create the postgres enum type first.
    user_type_enum.create(op.get_bind(), checkfirst=True)

    # 2. Add the column with a server default so existing rows get 'free'.
    op.add_column(
        'users',
        sa.Column(
            'user_type',
            user_type_enum,
            nullable=False,
            server_default='free',
        ),
    )

    # 3. Create an index for efficient filtering by plan.
    op.create_index(op.f('ix_users_user_type'), 'users', ['user_type'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_users_user_type'), table_name='users')
    op.drop_column('users', 'user_type')
    user_type_enum.drop(op.get_bind(), checkfirst=True)
