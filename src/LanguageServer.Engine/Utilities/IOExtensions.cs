using System;
using System.IO;
using System.Reactive;
using System.Reactive.Disposables;
using System.Reactive.Linq;
using System.Threading;
using System.Threading.Tasks.Dataflow;

namespace DocFXAssistant.LanguageServer.Utilities
{
    /// <summary>
    ///     Extension methods for System.IO.
    /// </summary>
    public static class IOExtensions
    {
        /// <summary>
        ///     Observe file-system events.
        /// </summary>
        /// <param name="watcher">
        ///     The <see cref="FileSystemWatcher"/>.
        /// </param>
        /// <returns>
        ///     An <see cref="IObservable{T}"/> sequence of <see cref="FileSystemEventArgs"/>.
        /// </returns>
        public static IObservable<FileSystemEventArgs> Observe(this FileSystemWatcher watcher)
        {
            if (watcher == null)
                throw new ArgumentNullException(nameof(watcher));
            
            return Observable.Create<FileSystemEventArgs>(subscriber =>
            {
                void OnNotify(object sender, FileSystemEventArgs eventArgs)
                {
                    subscriber.OnNext(eventArgs);
                }

                void OnError(object sender, ErrorEventArgs eventArgs)
                {
                    subscriber.OnError(
                        eventArgs.GetException()
                    );
                }

                watcher.Error += OnError;
                watcher.Created += OnNotify;
                watcher.Changed += OnNotify;
                watcher.Deleted += OnNotify;

                return Disposable.Create(() => 
                {
                    watcher.Error -= OnError;
                    watcher.Created -= OnNotify;
                    watcher.Changed -= OnNotify;
                    watcher.Deleted -= OnNotify;
                });
            });
        }

        /// <summary>
        ///     Create a <see cref="ISourceBlock{T}"/> that buffers events from the <see cref="FileSystemWatcher"/>.
        /// </summary>
        /// <param name="watcher">
        ///     The <see cref="FileSystemWatcher"/>.
        /// </param>
        /// <param name="cancellationToken">
        ///     An optional <see cref="CancellationToken"/> that can be used to cancel the <see cref="ISourceBlock{T}"/>'s operation. 
        /// </param>
        /// <returns>
        ///     The <see cref="BufferBlock{T}"/>.
        /// </returns>
        public static ISourceBlock<FileSystemEventArgs> CreateBufferBlock(this FileSystemWatcher watcher, CancellationToken cancellationToken = default(CancellationToken))
        {
            if (watcher == null)
                throw new ArgumentNullException(nameof(watcher));

            BufferBlock<FileSystemEventArgs> bufferBlock = new BufferBlock<FileSystemEventArgs>(
                new DataflowBlockOptions { CancellationToken = cancellationToken }
            );

            void OnNotify(object sender, FileSystemEventArgs eventArgs)
            {
                bufferBlock.Post(eventArgs);
            }

            void OnError(object sender, ErrorEventArgs eventArgs)
            {
                Exception exception = eventArgs.GetException();
                if (exception is InternalBufferOverflowException)
                    return;

                ((IDataflowBlock)bufferBlock).Fault(exception);
            }

            watcher.Error += OnError;
            watcher.Created += OnNotify;
            watcher.Changed += OnNotify;
            watcher.Deleted += OnNotify;

            bufferBlock.Completion.ContinueWith(_ => 
            {
                watcher.Error -= OnError;
                watcher.Created -= OnNotify;
                watcher.Changed -= OnNotify;
                watcher.Deleted -= OnNotify;
            });

            return bufferBlock;
        }
    }
}
