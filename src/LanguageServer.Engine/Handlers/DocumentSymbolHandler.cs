using JsonRpc;
using Lsp;
using Lsp.Capabilities.Client;
using Lsp.Models;
using Lsp.Protocol;
using Serilog;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
    
namespace DocFXAssistant.LanguageServer.Handlers
{
    using ContentProviders;
    using Documents;
    using Utilities;

    /// <summary>
    ///     Handler for document symbol requests.
    /// </summary>
    public sealed class DocumentSymbolHandler
        : Handler, IDocumentSymbolHandler
    {
        /// <summary>
        ///     Create a new <see cref="DocumentSymbolHandler"/>.
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
        public DocumentSymbolHandler(ILanguageServer server, Workspace workspace, ILogger logger)
            : base(server, logger)
        {
            if (workspace == null)
                throw new ArgumentNullException(nameof(workspace));

            Workspace = workspace;
        }

        /// <summary>
        ///     The document workspace.
        /// </summary>
        Workspace Workspace { get; }

        /// <summary>
        ///     The document selector that describes documents to synchronise.
        /// </summary>
        DocumentSelector DocumentSelector { get; } = new DocumentSelector(
            // TODO: Define document selectors.
        );

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
        ///     The server's document symbol capabilities.
        /// </summary>
        DocumentSymbolCapability DocumentSymbolCapabilities { get; set; }

        /// <summary>
        ///     Called when completions are requested.
        /// </summary>
        /// <param name="parameters">
        ///     The request parameters.
        /// </param>
        /// <param name="cancellationToken">
        ///     A <see cref="CancellationToken"/> that can be used to cancel the request.
        /// </param>
        /// <returns>
        ///     A <see cref="Task"/> representing the operation whose result is the completion list or <c>null</c> if no completions are provided.
        /// </returns>
        Task<SymbolInformationContainer> OnDocumentSymbols(DocumentSymbolParams parameters, CancellationToken cancellationToken)
        {
            return Task.FromResult<SymbolInformationContainer>(null);
        }

        /// <summary>
        ///     Get registration options for handling document events.
        /// </summary>
        /// <returns>
        ///     The registration options.
        /// </returns>
        TextDocumentRegistrationOptions IRegistration<TextDocumentRegistrationOptions>.GetRegistrationOptions() => DocumentRegistrationOptions;

        /// <summary>
        ///     Handle a request for document symbols.
        /// </summary>
        /// <param name="parameters">
        ///     The request parameters.
        /// </param>
        /// <param name="cancellationToken">
        ///     A <see cref="CancellationToken"/> that can be used to cancel the request.
        /// </param>
        /// <returns>
        ///     A <see cref="Task"/> representing the operation whose result is the symbol container or <c>null</c> if no symbols are provided.
        /// </returns>
        async Task<SymbolInformationContainer> IRequestHandler<DocumentSymbolParams, SymbolInformationContainer>.Handle(DocumentSymbolParams parameters, CancellationToken cancellationToken)
        {
            if (parameters == null)
                throw new ArgumentNullException(nameof(parameters));
            
            try
            {
                return await OnDocumentSymbols(parameters, cancellationToken);
            }
            catch (Exception unexpectedError)
            {
                Log.Error(unexpectedError, "Unhandled exception in {Method:l}.", "OnDocumentSymbols");

                return null;
            }
        }

        /// <summary>
        ///     Called to inform the handler of the language server's document symbol capabilities.
        /// </summary>
        /// <param name="capabilities">
        ///     A <see cref="DocumentSymbolCapability"/> data structure representing the capabilities.
        /// </param>
        void ICapability<DocumentSymbolCapability>.SetCapability(DocumentSymbolCapability capabilities)
        {
            if (capabilities == null)
                throw new ArgumentNullException(nameof(capabilities));

            DocumentSymbolCapabilities = capabilities;
        }
    }
}
