"""
Migration script to add assigned_doctor_id to patient_intakes
Revision ID: 123456789abc
Revises: 
Create Date: 2025-08-25 11:44:00
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '123456789abc'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('patient_intakes', sa.Column('assigned_doctor_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_patient_intakes_assigned_doctor', 'patient_intakes', 'users', ['assigned_doctor_id'], ['id'])

def downgrade():
    op.drop_constraint('fk_patient_intakes_assigned_doctor', 'patient_intakes', type_='foreignkey')
    op.drop_column('patient_intakes', 'assigned_doctor_id')
