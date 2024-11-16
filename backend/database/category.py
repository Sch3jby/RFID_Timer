# category.py
from . import db
from sqlalchemy.orm import validates
from sqlalchemy import CheckConstraint

class Category(db.Model):
    __tablename__ = 'category'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    gender = db.Column(db.String(1), nullable=False)
    min_age = db.Column(db.Integer, nullable=False)
    max_age = db.Column(db.Integer)  # NULL pro otevřené kategorie
    description = db.Column(db.String(5000))
    
    race_categories = db.relationship('RaceCategory', back_populates='category')
    
    # Přidat validace a omezení
    __table_args__ = (
        CheckConstraint('gender IN ("M", "F")', name='valid_gender'),
        CheckConstraint('min_age >= 0', name='valid_min_age'),
        CheckConstraint('max_age IS NULL OR (max_age > min_age)', name='valid_age_range'),
    )
    
    @validates('gender')
    def validate_gender(self, key, value):
        if value not in ['M', 'F']:
            raise ValueError("Gender must be 'M' or 'F'")
        return value
    
    @validates('min_age')
    def validate_min_age(self, key, value):
        if value < 0:
            raise ValueError("Minimum age cannot be negative")
        return value
        
    @validates('max_age')
    def validate_max_age(self, key, value):
        if value is not None:
            if value <= self.min_age:
                raise ValueError("Maximum age must be greater than minimum age")
        return value
    
    @classmethod
    def get_category_for_age(cls, age, gender):
        """Najde vhodnou kategorii podle věku a pohlaví"""
        if not isinstance(age, int) or age < 0:
            raise ValueError("Age must be a positive integer")
        if gender not in ['M', 'F']:
            raise ValueError("Gender must be 'M' or 'F'")
            
        return cls.query.filter(
            cls.gender == gender,
            cls.min_age <= age,
            (cls.max_age >= age) | (cls.max_age.is_(None))
        ).first()
    
    def __repr__(self):
        max_age_display = f"-{self.max_age}" if self.max_age else "+"
        return f"{self.name} ({self.gender} {self.min_age}{max_age_display})"
    
    def to_dict(self):
        """Převede kategorii na slovník pro API"""
        return {
            'id': self.id,
            'name': self.name,
            'gender': self.gender,
            'min_age': self.min_age,
            'max_age': self.max_age,
            'description': self.description
        }