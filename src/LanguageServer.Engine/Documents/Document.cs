using Nito.AsyncEx;
using Serilog;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Xml;

namespace DocFXAssistant.LanguageServer.Documents
{
    using Utilities;

    /// <summary>
    ///     Represents the document state for an MSBuild document.
    /// </summary>
    public abstract class Document
    {
        /// <summary>
        ///     Diagnostics (if any) for the document.
        /// </summary>
        readonly List<Lsp.Models.Diagnostic> _diagnostics = new List<Lsp.Models.Diagnostic>();

        /// <summary>
        ///     Create a new <see cref="Document"/>.
        /// </summary>
        /// <param name="workspace">
        ///     The document workspace.
        /// </param>
        /// <param name="documentUri">
        ///     The document URI.
        /// </param>
        /// <param name="logger">
        ///     The application logger.
        /// </param>
        protected Document(Workspace workspace, Uri documentUri, ILogger logger)
        {
            if (workspace == null)
                throw new ArgumentNullException(nameof(workspace));

            if (documentUri == null)
                throw new ArgumentNullException(nameof(documentUri));

            Workspace = workspace;
            Uri = documentUri;
            File = new FileInfo(
                VSCodeDocumentUri.GetFileSystemPath(documentUri)
            );

            Log = logger.ForContext("Document", File.FullName);
        }

        /// <summary>
        ///     The document workspace.
        /// </summary>
        public Workspace Workspace { get; }

        /// <summary>
        ///     The document URI.
        /// </summary>
        public Uri Uri { get; }

        /// <summary>
        ///     The document file.
        /// </summary>
        public FileInfo File { get; }

        /// <summary>
        ///     The kind of document.
        /// </summary>
        public abstract DocumentKind Kind { get; }

        /// <summary>
        ///     A lock used to control access to document state.
        /// </summary>
        public AsyncReaderWriterLock Lock { get; } = new AsyncReaderWriterLock();

        /// <summary>
        ///     Are there currently any diagnostics to be published for the document?
        /// </summary>
        public bool HasDiagnostics => _diagnostics.Count > 0;

        /// <summary>
        ///     Diagnostics (if any) for the document.
        /// </summary>
        public IReadOnlyList<Lsp.Models.Diagnostic> Diagnostics => _diagnostics;

        /// <summary>
        ///     Does the document have in-memory changes?
        /// </summary>
        public bool IsDirty { get; protected set; }

        /// <summary>
        ///     The document textual positional lookup facility.
        /// </summary>
        public TextPositions TextPositions { get; protected set; }

        /// <summary>
        ///     The document's logger.
        /// </summary>
        protected ILogger Log { get; set; }

        /// <summary>
        ///     Load the document.
        /// </summary>
        /// <param name="cancellationToken">
        ///     An optional <see cref="CancellationToken"/> that can be used to cancel the operation.
        /// </param>
        /// <returns>
        ///     A task representing the load operation.
        /// </returns>
        public async Task Load(CancellationToken cancellationToken = default(CancellationToken))
        {
            ClearDiagnostics();
            TextPositions = null;

            await OnLoad(cancellationToken);

            using (TextReader textReader = await ReadDocumentText())
            {
                cancellationToken.ThrowIfCancellationRequested();

                string documentText = await textReader.ReadToEndAsync();
                if (documentText != null)
                    TextPositions =  new TextPositions(documentText);
            }
            
            IsDirty = false;
        }

        /// <summary>
        ///     Update the document's in-memory state.
        /// </summary>
        /// <param name="text">
        ///     The document text.
        /// </param>
        /// <param name="cancellationToken">
        ///     An optional <see cref="CancellationToken"/> that can be used to cancel the operation.
        /// </param>
        /// <returns>
        ///     A task representing the update operation.
        /// </returns>
        public async Task Update(string text, CancellationToken cancellationToken = default(CancellationToken))
        {
            if (text == null)
                throw new ArgumentNullException(nameof(text));

            ClearDiagnostics();
            TextPositions = null;

            await OnUpdate(text, cancellationToken);
            
            TextPositions = new TextPositions(text);
            IsDirty = true;
        }

        /// <summary>
        ///     Unload the document.
        /// </summary>
        /// <param name="cancellationToken">
        ///     An optional <see cref="CancellationToken"/> that can be used to cancel the operation.
        /// </param>
        /// <returns>
        ///     A task representing the unload operation.
        /// </returns>
        public async Task Unload(CancellationToken cancellationToken = default(CancellationToken))
        {
            await OnUnload(cancellationToken);

            TextPositions = null;
            IsDirty = false;
        }

        /// <summary>
        ///     Get a <see cref="TextReader"/> for the document text.
        /// </summary>
        /// <returns>
        ///     The <see cref="TextReader"/>, or <c>null</c> if the document does not exist.
        /// </returns>
        protected virtual Task<TextReader> ReadDocumentText()
        {
            if (!File.Exists)
                return null;

            return Task.FromResult(
                (TextReader)File.OpenText()
            );
        }

        /// <summary>
        ///     Called when the document is being loaded.
        /// </summary>
        /// <param name="cancellationToken">
        ///     An optional <see cref="CancellationToken"/> that can be used to cancel the operation.
        /// </param>
        /// <returns>
        ///     A task representing the load operation.
        /// </returns>        
        protected abstract Task OnLoad(CancellationToken cancellationToken = default(CancellationToken));

        /// <summary>
        ///     Called when the document text is being updated.
        /// </summary>
        /// <param name="text">
        ///     The updated document text.
        /// </param>
        /// <param name="cancellationToken">
        ///     An optional <see cref="CancellationToken"/> that can be used to cancel the operation.
        /// </param>
        /// <returns>
        ///     A task representing the update operation.
        /// </returns>        
        protected abstract Task OnUpdate(string text, CancellationToken cancellationToken = default(CancellationToken));

        /// <summary>
        ///     Called when the document is being unloaded.
        /// </summary>
        /// <param name="cancellationToken">
        ///     An optional <see cref="CancellationToken"/> that can be used to cancel the operation.
        /// </param>
        /// <returns>
        ///     A task representing the load operation.
        /// </returns>        
        protected abstract Task OnUnload(CancellationToken cancellationToken = default(CancellationToken));

        /// <summary>
        ///     Remove all diagnostics for the document file.
        /// </summary>
        protected void ClearDiagnostics()
        {
            _diagnostics.Clear();
        }

        /// <summary>
        ///     Add a diagnostic to be published for the document file.
        /// </summary>
        /// <param name="severity">
        ///     The diagnostic severity.
        /// </param>
        /// <param name="message">
        ///     The diagnostic message.
        /// </param>
        /// <param name="range">
        ///     The range of text within the document XML that the diagnostic relates to.
        /// </param>
        /// <param name="diagnosticCode">
        ///     A code to identify the diagnostic type.
        /// </param>
        protected void AddDiagnostic(Lsp.Models.DiagnosticSeverity severity, string message, Range range, string diagnosticCode)
        {
            if (String.IsNullOrWhiteSpace(message))
                throw new ArgumentException("Argument cannot be null, empty, or entirely composed of whitespace: 'message'.", nameof(message));
            
            _diagnostics.Add(new Lsp.Models.Diagnostic
            {
                Severity = severity,
                Code = new Lsp.Models.DiagnosticCode(diagnosticCode),
                Message = message,
                Range = range.ToLsp(),
                Source = File.FullName
            });
        }

        /// <summary>
        ///     Add an error diagnostic to be published for the document file.
        /// </summary>
        /// <param name="message">
        ///     The diagnostic message.
        /// </param>
        /// <param name="range">
        ///     The range of text within the document XML that the diagnostic relates to.
        /// </param>
        /// <param name="diagnosticCode">
        ///     A code to identify the diagnostic type.
        /// </param>
        protected void AddErrorDiagnostic(string message, Range range, string diagnosticCode) => AddDiagnostic(Lsp.Models.DiagnosticSeverity.Error, message, range, diagnosticCode);

        /// <summary>
        ///     Add a warning diagnostic to be published for the document file.
        /// </summary>
        /// <param name="message">
        ///     The diagnostic message.
        /// </param>
        /// <param name="range">
        ///     The range of text within the document XML that the diagnostic relates to.
        /// </param>
        /// <param name="diagnosticCode">
        ///     A code to identify the diagnostic type.
        /// </param>
        protected void AddWarningDiagnostic(string message, Range range, string diagnosticCode) => AddDiagnostic(Lsp.Models.DiagnosticSeverity.Warning, message, range, diagnosticCode);

        /// <summary>
        ///     Add an informational diagnostic to be published for the document file.
        /// </summary>
        /// <param name="message">
        ///     The diagnostic message.
        /// </param>
        /// <param name="range">
        ///     The range of text within the document XML that the diagnostic relates to.
        /// </param>
        /// <param name="diagnosticCode">
        ///     A code to identify the diagnostic type.
        /// </param>
        protected void AddInformationDiagnostic(string message, Range range, string diagnosticCode) => AddDiagnostic(Lsp.Models.DiagnosticSeverity.Information, message, range, diagnosticCode);

        /// <summary>
        ///     Add a hint diagnostic to be published for the document file.
        /// </summary>
        /// <param name="message">
        ///     The diagnostic message.
        /// </param>
        /// <param name="range">
        ///     The range of text within the document XML that the diagnostic relates to.
        /// </param>
        /// <param name="diagnosticCode">
        ///     A code to identify the diagnostic type.
        /// </param>
        protected void AddHintDiagnostic(string message, Range range, string diagnosticCode) => AddDiagnostic(Lsp.Models.DiagnosticSeverity.Hint, message, range, diagnosticCode);
    }
}
