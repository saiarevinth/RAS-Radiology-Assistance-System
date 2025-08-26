"""
Revision ID: abcd1234efgh
Revises: 123456789abc
Create Date: 2025-08-26 13:01:31.000000

Alembic migration script to add high_priority column to patient_intakes table
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'abcd1234efgh'
down_revision = '123456789abc'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('patient_intakes', sa.Column('high_priority', sa.Boolean(), nullable=True))

def downgrade():
    op.drop_column('patient_intakes', 'high_priority')
