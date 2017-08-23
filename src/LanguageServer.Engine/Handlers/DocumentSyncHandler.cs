using Lsp;
using Lsp.Capabilities.Client;
using Lsp.Capabilities.Server;
using Lsp.Models;
using Lsp.Protocol;
using Serilog;
using System;
using System.Threading.Tasks;
using System.Linq;
using System.Threading;
using System.IO;
using JsonRpc;

namespace DocFXAssistant.LanguageServer.Handlers
{
    using Documents;
    using Utilities;

    /// <summary>
    ///     The handler for language server document synchronisation.
    /// </summary>
    public sealed class DocumentSyncHandler
        : Handler, ITextDocumentSyncHandler
    {
        /// <summary>
        ///     Create a new <see cref="DocumentSyncHandler"/>.
        /// </summary>
        /// <param name="server">
        ///     The language server.
        /// </param>
        /// <param name="workspace">
        ///     The document workspace.
        /// </param>
        /// <param name="logger">
        ///     The application logger.
        /// </param>
        public DocumentSyncHandler(ILanguageServer server, Workspace workspace, ILogger logger)
            : base(server, logger)
        {
            if (workspace == null)
                throw new ArgumentNullException(nameof(workspace));
            
            Workspace = workspace;
        }

        /// <summary>
        ///     Options that control synchronisation.
        /// </summary>
        public TextDocumentSyncOptions Options { get; } = new TextDocumentSyncOptions
        {
            WillSaveWaitUntil = false,
            WillSave = true,
            Change = TextDocumentSyncKind.Full,
            Save = new SaveOptions
            {
                IncludeText = true
            },
            OpenClose = true
        };

        /// <summary>
        ///     The document selector that describes documents to synchronise.
        /// </summary>
        DocumentSelector DocumentSelector { get; } = new DocumentSelector(
            // TODO: Define document selectors.
        );

        /// <summary>
        ///     The document workspace.
        /// </summary>
        Workspace Workspace { get; }

        /// <summary>
        ///     The server's synchronisation capabilities.
        /// </summary>
        SynchronizationCapability SynchronizationCapabilities { get; set; }

        /// <summary>
        ///     Get registration options for handling document events.
        /// </summary>
        TextDocumentRegistrationOptions DocumentRegistrationOptions
        {
            get => new TextDocumentRegistrationOptions
            {
                DocumentSelector = DocumentSelector
            };
        }

        /// <summary>
        ///     Get registration options for handling document-change events.
        /// </summary>
        TextDocumentChangeRegistrationOptions DocumentChangeRegistrationOptions
        {
            get => new TextDocumentChangeRegistrationOptions
            {
                DocumentSelector = DocumentSelector,
                SyncKind = Options.Change
            };
        }

        /// <summary>
        ///     Get registration options for handling document save events.
        /// </summary>
        TextDocumentSaveRegistrationOptions DocumentSaveRegistrationOptions
        {
            get => new TextDocumentSaveRegistrationOptions
            {
                DocumentSelector = DocumentSelector,
                IncludeText = Options.Save.IncludeText
            };
        }

        /// <summary>
        ///     Called when a text document is opened.
        /// </summary>
        /// <param name="parameters">
        ///     The notification parameters.
        /// </param>
        /// <returns>
        ///     A <see cref="Task"/> representing the operation.
        /// </returns>
        Task OnDidOpenTextDocument(DidOpenTextDocumentParams parameters)
        {
            return Task.CompletedTask;
        }

        /// <summary>
        ///     Called when a text document is changed.
        /// </summary>
        /// <param name="parameters">
        ///     The notification parameters.
        /// </param>
        /// <returns>
        ///     A <see cref="Task"/> representing the operation.
        /// </returns>
        Task OnDidChangeTextDocument(DidChangeTextDocumentParams parameters)
        {
            return Task.CompletedTask;
        }

        /// <summary>
        ///     Called when a text document is saved.
        /// </summary>
        /// <param name="parameters">
        ///     The notification parameters.
        /// </param>
        /// <returns>
        ///     A <see cref="Task"/> representing the operation.
        /// </returns>
        Task OnDidSaveTextDocument(DidSaveTextDocumentParams parameters)
        {
            return Task.CompletedTask;
        }

        /// <summary>
        ///     Called when a text document is closed.
        /// </summary>
        /// <param name="parameters">
        ///     The notification parameters.
        /// </param>
        /// <returns>
        ///     A <see cref="Task"/> representing the operation.
        /// </returns>
        Task OnDidCloseTextDocument(DidCloseTextDocumentParams parameters)
        {
            return Task.CompletedTask;
        }

        /// <summary>
        ///     Get attributes for the specified text document.
        /// </summary>
        /// <param name="documentUri">
        ///     The document URI.
        /// </param>
        /// <returns>
        ///     The document attributes.
        /// </returns>
        TextDocumentAttributes GetTextDocumentAttributes(Uri documentUri)
        {
            string documentFilePath = VSCodeDocumentUri.GetFileSystemPath(documentUri);
            if (documentFilePath == null)
                return new TextDocumentAttributes(documentUri, "plaintext");

            string extension = Path.GetExtension(documentFilePath).ToLower();
            switch (extension)
            {
                case ".md":
                case ".mdown":
                case ".markdown":
                {
                    return new TextDocumentAttributes(documentUri, "markdown");
                }
                default:
                {
                    return new TextDocumentAttributes(documentUri, "plaintext");
                }
            }
        }

        /// <summary>
        ///     Handle a document being opened.
        /// </summary>
        /// <param name="parameters">
        ///     The notification parameters.
        /// </param>
        /// <returns>
        ///     A <see cref="Task"/> representing the operation.
        /// </returns>
        async Task INotificationHandler<DidOpenTextDocumentParams>.Handle(DidOpenTextDocumentParams parameters)
        {
            if (parameters == null)
                throw new ArgumentNullException(nameof(parameters));
            
            try
            {
                await OnDidOpenTextDocument(parameters);
            }
            catch (Exception unexpectedError)
            {
                Log.Error(unexpectedError, "Unhandled exception in {Method:l}.", "OnDidOpenTextDocument");
            }
        }

        /// <summary>
        ///     Handle a document being closed.
        /// </summary>
        /// <param name="parameters">
        ///     The notification parameters.
        /// </param>
        /// <returns>
        ///     A <see cref="Task"/> representing the operation.
        /// </returns>
        async Task INotificationHandler<DidCloseTextDocumentParams>.Handle(DidCloseTextDocumentParams parameters)
        {
            if (parameters == null)
                throw new ArgumentNullException(nameof(parameters));

            try
            {
                await OnDidCloseTextDocument(parameters);
            }
            catch (Exception unexpectedError)
            {
                Log.Error(unexpectedError, "Unhandled exception in {Method:l}.", "OnDidCloseTextDocument");
            }
        }

        /// <summary>
        ///     Handle a change in document text.
        /// </summary>
        /// <param name="parameters">
        ///     The notification parameters.
        /// </param>
        /// <returns>
        ///     A <see cref="Task"/> representing the operation.
        /// </returns>
        async Task INotificationHandler<DidChangeTextDocumentParams>.Handle(DidChangeTextDocumentParams parameters)
        {
            if (parameters == null)
                throw new ArgumentNullException(nameof(parameters));

            try
            {
                await OnDidChangeTextDocument(parameters);
            }
            catch (Exception unexpectedError)
            {
                Log.Error(unexpectedError, "Unhandled exception in {Method:l}.", "OnDidChangeTextDocument");
            }
        }

        /// <summary>
        ///     Handle a document being saved.
        /// </summary>
        /// <param name="parameters">
        ///     The notification parameters.
        /// </param>
        /// <returns>
        ///     A <see cref="Task"/> representing the operation.
        /// </returns>
        async Task INotificationHandler<DidSaveTextDocumentParams>.Handle(DidSaveTextDocumentParams parameters)
        {
            if (parameters == null)
                throw new ArgumentNullException(nameof(parameters));

            try
            {
                await OnDidSaveTextDocument(parameters);
            }
            catch (Exception unexpectedError)
            {
                Log.Error(unexpectedError, "Unhandled exception in {Method:l}.", "OnDidSaveTextDocument");
            }
        }

        /// <summary>
        ///     Get registration options for handling document events.
        /// </summary>
        /// <returns>
        ///     The registration options.
        /// </returns>
        TextDocumentRegistrationOptions IRegistration<TextDocumentRegistrationOptions>.GetRegistrationOptions() => DocumentRegistrationOptions;

        /// <summary>
        ///     Get registration options for handling document-change events.
        /// </summary>
        /// <returns>
        ///     The registration options.
        /// </returns>
        TextDocumentChangeRegistrationOptions IRegistration<TextDocumentChangeRegistrationOptions>.GetRegistrationOptions() => DocumentChangeRegistrationOptions;

        /// <summary>
        ///     Get registration options for handling document save events.
        /// </summary>
        /// <returns>
        ///     The registration options.
        /// </returns>
        TextDocumentSaveRegistrationOptions IRegistration<TextDocumentSaveRegistrationOptions>.GetRegistrationOptions() => DocumentSaveRegistrationOptions;

        /// <summary>
        ///     Called to inform the handler of the language server's document-synchronisation capabilities.
        /// </summary>
        /// <param name="capabilities">
        ///     A <see cref="SynchronizationCapability"/> data structure representing the capabilities.
        /// </param>
        void ICapability<SynchronizationCapability>.SetCapability(SynchronizationCapability capabilities)
        {
            if (capabilities == null)
                throw new ArgumentNullException(nameof(capabilities));

            SynchronizationCapabilities = capabilities;
        }

        /// <summary>
        ///     Get attributes for the specified text document.
        /// </summary>
        /// <param name="documentUri">
        ///     The document URI.
        /// </param>
        /// <returns>
        ///     The document attributes.
        /// </returns>
        TextDocumentAttributes ITextDocumentSyncHandler.GetTextDocumentAttributes(Uri documentUri)
        {
            if (documentUri == null)
                throw new ArgumentNullException(nameof(documentUri));

            return GetTextDocumentAttributes(documentUri);
        }
    }
}
