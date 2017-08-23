using Lsp.Models;
using Lsp.Protocol;
using Serilog;
using System;
using System.Collections.Concurrent;
using System.Linq;
using System.Threading.Tasks;
using System.Xml;

namespace DocFXAssistant.LanguageServer.Documents
{
    using Utilities;

    /// <summary>
    ///     The workspace that holds documents.
    /// </summary>
    public class Workspace
    {
        /// <summary>
        ///     Documents, keyed by document URI.
        /// </summary>
        readonly ConcurrentDictionary<Uri, Document> _documents = new ConcurrentDictionary<Uri, Document>();
        
        /// <summary>
        ///     Create a new <see cref="Workspace"/>.
        /// </summary>
        /// <param name="server">
        ///     The language server.
        /// </param>
        /// <param name="configuration">
        ///     The language server configuration.
        /// </param>
        /// <param name="logger">
        ///     The application logger.
        /// </param>
        public Workspace(Lsp.ILanguageServer server, Configuration configuration, ILogger logger)
        {
            if (server == null)
                throw new ArgumentNullException(nameof(server));

            if (configuration == null)
                throw new ArgumentNullException(nameof(configuration));
            
            if (logger == null)
                throw new ArgumentNullException(nameof(logger));
            
            Server = server;
            Configuration = configuration;
            Log = logger.ForContext<Workspace>();
        }

        /// <summary>
        ///     The root directory for the workspace.
        /// </summary>
        public string RootDirectory => Server.Client.RootPath;

        /// <summary>
        ///     The language server configuration.
        /// </summary>
        public Configuration Configuration { get; }

        /// <summary>
        ///     The language server.
        /// </summary>
        Lsp.ILanguageServer Server { get; }

        /// <summary>
        ///     The workspace logger.
        /// </summary>
        ILogger Log { get; }

        /// <summary>
        ///     Try to retrieve the current state for the specified document.
        /// </summary>
        /// <param name="documentUri">
        ///     The document URI.
        /// </param>
        /// <param name="reload">
        ///     Reload the document if it is already loaded?
        /// </param>
        /// <returns>
        ///     The document.
        /// </returns>
        public async Task<Document> GetDocument(Uri documentUri, bool reload = false)
        {
            string documentFilePath = VSCodeDocumentUri.GetFileSystemPath(documentUri);

            bool isNewProject = false;
            Document document = _documents.GetOrAdd(documentUri, _ =>
            {
                isNewProject = true;

                throw new NotImplementedException();
            });

            try
            {
                if (isNewProject || reload)
                {
                    using (await document.Lock.WriterLockAsync())
                    {
                        await document.Load();
                    }
                }
            }
            catch (XmlException invalidXml)
            {
                Log.Error("Error parsing document file {DocumentFilePath}: {ErrorMessage:l}",
                    documentFilePath,
                    invalidXml.Message
                );
            }
            catch (Exception loadError)
            {
                Log.Error(loadError, "Unexpected error loading file {DocumentFilePath}.", documentFilePath);
            }

            return document;
        }

        /// <summary>
        ///     Try to update the current state for the specified document.
        /// </summary>
        /// <param name="documentUri">
        ///     The document URI.
        /// </param>
        /// <param name="documentText">
        ///     The new document text.
        /// </param>
        /// <returns>
        ///     The document.
        /// </returns>
        public async Task<Document> UpdateDocument(Uri documentUri, string documentText)
        {
            Document document;
            if (!_documents.TryGetValue(documentUri, out document))
            {
                Log.Error("Tried to update non-existent document with document URI {DocumentUri}.", documentUri);

                throw new InvalidOperationException($"Project with document URI '{documentUri}' is not loaded.");
            }

            try
            {
                using (await document.Lock.WriterLockAsync())
                {
                    await document.Update(documentText);
                }
            }
            catch (Exception updateError)
            {
                Log.Error(updateError, "Failed to update document {DocumentFile}.", document.File.FullName);
            }

            return document;
        }

        /// <summary>
        ///     Publish current diagnostics (if any) for the specified document.
        /// </summary>
        /// <param name="document">
        ///     The document.
        /// </param>
        public void PublishDiagnostics(Document document)
        {
            if (document == null)
                throw new ArgumentNullException(nameof(document));

            Server.PublishDiagnostics(new PublishDiagnosticsParams
            {
                Uri = document.Uri,
                Diagnostics = document.Diagnostics.ToArray()
            });   
        }

        /// <summary>
        ///     Clear current diagnostics (if any) for the specified document.
        /// </summary>
        /// <param name="document">
        ///     The document.
        /// </param>
        public void ClearDiagnostics(Document document)
        {
            if (document == null)
                throw new ArgumentNullException(nameof(document));

            if (!document.HasDiagnostics)
                return;

            Server.PublishDiagnostics(new PublishDiagnosticsParams
            {
                Uri = document.Uri,
                Diagnostics = new Lsp.Models.Diagnostic[0] // Overwrites existing diagnostics for this document with an empty list
            });   
        }

        /// <summary>
        ///     Remove a document from the workspace.
        /// </summary>
        /// <param name="documentUri">
        ///     The document URI.
        /// </param>
        /// <returns>
        ///     A <see cref="Task{TResult}"/> that resolves to <c>true</c> if the document was removed to the workspace; otherwise, <c>false</c>.
        /// </returns>
        public async Task<bool> RemoveDocument(Uri documentUri)
        {
            if (documentUri == null)
                throw new ArgumentNullException(nameof(documentUri));
            
            Document document;
            if (!_documents.TryRemove(documentUri, out document))
                return false;
            
            using (await document.Lock.WriterLockAsync())
            {
                ClearDiagnostics(document);

                await document.Unload();
            }

            return true;
        }
    }
}
