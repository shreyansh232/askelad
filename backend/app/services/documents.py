import io

from sqlalchemy import select
from app.config import get_settings
from pinecone import Pinecone
from supabase import create_client, Client
from typing import Optional, List
from langchain_openai import OpenAIEmbeddings
from sqlalchemy.ext.asyncio import AsyncSession
from pypdf import PdfReader
from langchain_pinecone import PineconeVectorStore
from app.db.models import Document

settings = get_settings()


class DocumentService:
    def __init__(self):
        # Pinecone Initialization
        self.pinecone = (
            Pinecone(api_key=settings.pinecone_api_key.get_secret_value())
            if settings.pinecone_api_key
            else None
        )

        # Supabase Initialization
        self.supabase: Optional[Client] = (
            create_client(
                settings.supabase_url, settings.supabase_service_key.get_secret_value()
            )
            if settings.supabase_url and settings.supabase_service_key
            else None
        )
        # Embeddings Initialization
        if settings.openai_api_key:
            self.embeddings = OpenAIEmbeddings(
                openai_api_key=settings.openai_api_key.get_secret_value(),
                model="text-embedding-3-large",
                dimensions=1024 # Match user's Pinecone index dimension
            )
        else:
            self.embeddings = None

    async def get_project_documents(
        self, db: AsyncSession, project_id: str
    ) -> List[Document]:
        result = await db.execute(
            select(Document).where(Document.project_id == project_id)
        )
        return list(result.scalars().all())

    async def index_project_metadata(self, project_id: str, name: str, industry: str, description: str):
        """Indexes the core project details as a primary context block."""
        if not (self.pinecone and self.embeddings):
            print(f"DEBUG: Skipping metadata indexing for {project_id}. Pinecone/Embeddings not configured.")
            return

        text = f"Project Name: {name}\nIndustry: {industry}\nDescription: {description}"
        print(f"DEBUG: Indexing metadata for project {project_id}")
        
        vector_store = PineconeVectorStore(
            index_name=settings.pinecone_index_name,
            embedding=self.embeddings,
            namespace=project_id,
            pinecone_api_key=settings.pinecone_api_key.get_secret_value()
        )
        
        vector_store.add_texts(
            texts=[text],
            metadatas=[{"type": "project_metadata", "project_id": project_id}]
        )

    async def delete_document(self, db: AsyncSession, document_id: str, project_id: str):
        # 1. Get document from DB
        result = await db.execute(select(Document).where(Document.id == document_id, Document.project_id == project_id))
        doc = result.scalar_one_or_none()
        if not doc:
            return False

        # 2. Delete from Pinecone
        if self.pinecone and doc.vector_id:
            try:
                index = self.pinecone.Index(settings.pinecone_index_name)
                index.delete(ids=[doc.vector_id], namespace=project_id)
            except Exception as e:
                print(f"Error deleting from Pinecone: {e}")

        # 3. Delete from Supabase
        if self.supabase:
            try:
                path = f"{project_id}/{doc.filename}"
                self.supabase.storage.from_(settings.supabase_bucket).remove([path])
            except Exception as e:
                print(f"Error deleting from Supabase: {e}")

        # 4. Delete from DB
        await db.delete(doc)
        await db.commit()
        return True

    async def upload_and_index(
        self, db: AsyncSession, project_id: str, file_content: bytes, filename: str
    ):
        if not self.supabase:
            raise Exception("Supabase not configured")

        content_type = "application/pdf" if filename.endswith(".pdf") else "text/plain"
        path = f"{project_id}/{filename}"
        
        print(f"DEBUG: Uploading {filename} to Supabase storage")
        # Note: supabase-py's storage upload is synchronous
        self.supabase.storage.from_(settings.supabase_bucket).upload(
            path=path,
            file=file_content,
            file_options={"content-type": content_type},
        )

        storage_url = self.supabase.storage.from_(
            settings.supabase_bucket
        ).get_public_url(path)

        text = ""

        if filename.endswith(".pdf"):
            reader = PdfReader(io.BytesIO(file_content))
            for page in reader.pages:
                text += page.extract_text() + "\n"
        else:
            text = file_content.decode("utf-8", errors="ignore")

        vector_id = None

        if self.pinecone and self.embeddings and text.strip():
            print(f"DEBUG: Indexing {filename} content in Pinecone namespace {project_id}")
            index_name = settings.pinecone_index_name
            vector_store = PineconeVectorStore(
                index_name=index_name, 
                embedding=self.embeddings, 
                namespace=project_id,
                pinecone_api_key=settings.pinecone_api_key.get_secret_value()
            )

            ids = vector_store.add_texts(
                texts=[text],
                metadatas=[{"filename": filename, "project_id": project_id, "type": "document"}],
            )
            vector_id = ids[0] if ids else None
        else:
            print(f"DEBUG: Skipping Pinecone indexing for {filename}. Pinecone={bool(self.pinecone)}, Embeddings={bool(self.embeddings)}, TextLength={len(text.strip())}")

        new_doc = Document(
            project_id=project_id,
            filename=filename,
            file_type=content_type,
            storage_url=storage_url,
            vector_id=vector_id,
        )
        db.add(new_doc)
        return new_doc


document_service = DocumentService()
