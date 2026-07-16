/// A last-in, first-out collection.
///
/// This is named [LifoStack] to avoid colliding with Flutter's `Stack` widget.
class LifoStack<T> {
  final List<T> _elements = [];

  void push(T element) {
    _elements.add(element);
  }

  /// Removes and returns the most recently pushed element.
  ///
  /// Throws a [StateError] when the stack is empty.
  T pop() {
    if (_elements.isEmpty) {
      throw StateError('Cannot pop from an empty stack.');
    }
    return _elements.removeLast();
  }

  /// Returns the most recently pushed element without removing it.
  ///
  /// Throws a [StateError] when the stack is empty.
  T peek() {
    if (_elements.isEmpty) {
      throw StateError('Cannot peek at an empty stack.');
    }
    return _elements.last;
  }

  int get length => _elements.length;
  bool get isEmpty => _elements.isEmpty;
  bool get isNotEmpty => _elements.isNotEmpty;
}
