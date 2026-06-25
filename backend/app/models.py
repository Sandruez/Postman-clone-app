from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
import datetime
from .database import Base

class Collection(Base):
    __tablename__ = "collections"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    requests = relationship("Request", back_populates="collection", cascade="all, delete-orphan")

class Request(Base):
    __tablename__ = "requests"

    id = Column(Integer, primary_key=True, index=True)
    collection_id = Column(Integer, ForeignKey("collections.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    method = Column(String, nullable=False)
    url = Column(Text, nullable=False)
    headers_json = Column(Text, default="[]")  # JSON array of {key, value, enabled}
    body_type = Column(String, default="none")  # none, raw, form-data, urlencoded
    body_raw = Column(Text, default="")
    body_form_data_json = Column(Text, default="[]")  # JSON array of {key, value, enabled}
    body_url_encoded_json = Column(Text, default="[]")  # JSON array of {key, value, enabled}
    auth_type = Column(String, default="none")  # none, bearer, basic
    auth_config_json = Column(Text, default="{}")  # JSON of token, username, password, etc.
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    collection = relationship("Collection", back_populates="requests")

class Environment(Base):
    __tablename__ = "environments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    variables = relationship("Variable", back_populates="environment", cascade="all, delete-orphan")

class Variable(Base):
    __tablename__ = "variables"

    id = Column(Integer, primary_key=True, index=True)
    environment_id = Column(Integer, ForeignKey("environments.id", ondelete="CASCADE"), nullable=False)
    key = Column(String, nullable=False)
    value = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    environment = relationship("Environment", back_populates="variables")

class History(Base):
    __tablename__ = "history"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    method = Column(String, nullable=False)
    url = Column(Text, nullable=False)
    headers_json = Column(Text, default="[]")
    body_type = Column(String, default="none")
    body_raw = Column(Text, default="")
    body_form_data_json = Column(Text, default="[]")
    body_url_encoded_json = Column(Text, default="[]")
    auth_type = Column(String, default="none")
    auth_config_json = Column(Text, default="{}")
    
    # Response details
    response_status = Column(Integer, nullable=True)
    response_time_ms = Column(Integer, nullable=True)
    response_size_bytes = Column(Integer, nullable=True)
    response_headers_json = Column(Text, default="[]")
    response_body = Column(Text, default="")
    sent_at = Column(DateTime, default=datetime.datetime.utcnow)
